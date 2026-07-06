// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import "../lib/FHE.sol";
import "../gateway/FhishGatewayCaller.sol";

/**
 * @title ConfidentialPayroll — encrypted salaries, only the total revealed
 * @notice The employer records each employee's CLIENT-ENCRYPTED salary. The contract keeps an
 *         encrypted running total with `FHE.add`. Individual salaries stay secret forever; only the
 *         aggregate payroll is decrypted (e.g. for budgeting/audit). A classic confidential-compute
 *         use case: aggregate over private data without exposing any single value.
 */
contract ConfidentialPayroll is FhishGatewayCaller {
    using FHE for euint32;

    address public immutable employer;
    mapping(address => euint32) private salaryOf;
    mapping(address => bool) public isEmployee;
    address[] public employees;
    euint32 private total;
    bool private initialized;

    bool public totalRevealed;
    uint32 public revealedTotal;

    event SalarySet(address indexed employee);
    event TotalRequested(uint256 decryptionId);
    event TotalRevealed(uint32 total);

    modifier onlyEmployer() { require(msg.sender == employer, "only employer"); _; }

    constructor(address gateway, address acl, address executor, address kms) FhishGatewayCaller(gateway) {
        employer = msg.sender;
        FHE.setCoprocessor(FhishConfigStruct({
            ACLAddress: acl, FhishExecutorAddress: executor, KMSVerifierAddress: kms, InputVerifierAddress: address(0)
        }));
    }

    /// @notice Set an employee's encrypted salary; the encrypted total is updated homomorphically.
    function setSalary(address employee, externalEuint32 encSalary, bytes calldata proof) external onlyEmployer {
        euint32 salary = FHE.fromExternal(encSalary, proof);
        FHE.allowThis(salary);
        FHE.allow(salary, employee); // the employee may decrypt their own salary

        if (!isEmployee[employee]) { isEmployee[employee] = true; employees.push(employee); }
        salaryOf[employee] = salary;
        total = initialized ? FHE.add(total, salary) : salary;
        initialized = true;
        FHE.allowThis(total);
        emit SalarySet(employee);
    }

    /// @notice Ask the gateway to decrypt ONLY the aggregate payroll total.
    function revealTotal() external onlyEmployer {
        require(initialized, "no salaries");
        uint256[] memory handles = new uint256[](1);
        handles[0] = uint256(FHE.toBytes32(total));
        uint256 id = _requestDecryption(handles, this.fulfillTotal.selector, 0, 0, false);
        emit TotalRequested(id);
    }

    function fulfillTotal(bytes calldata data) external onlyGateway {
        require(!totalRevealed, "revealed");
        (, bytes memory result) = abi.decode(data, (uint256, bytes));
        revealedTotal = abi.decode(result, (uint32));
        totalRevealed = true;
        emit TotalRevealed(revealedTotal);
    }

    function employeeCount() external view returns (uint256) { return employees.length; }
    function mySalaryHandle() external view returns (bytes32) { return FHE.toBytes32(salaryOf[msg.sender]); }
    function totalHandle() external view returns (bytes32) { return FHE.toBytes32(total); }
}
