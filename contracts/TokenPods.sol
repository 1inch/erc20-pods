// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@1inch/solidity-utils/contracts/libraries/AddressSet.sol";

import "./interfaces/IPod.sol";

abstract contract TokenPods {
    using AddressSet for AddressSet.Data;
    using AddressArray for AddressArray.Data;

    error PodsLimitReachedForAccount();
    error PodAlreadyAdded();
    error PodNotFound();
    error InvalidPodAddress();
    error InsufficientGas();

    uint256 private constant _POD_CALL_GAS_LIMIT = 200_000;

    uint256 public immutable podsLimit;

    mapping(address => AddressSet.Data) private _pods;

    constructor(uint256 podsLimit_) {
        podsLimit = podsLimit_;
    }

    function hasPod(address account, address pod) public view virtual returns(bool) {
        return _pods[account].contains(pod);
    }

    function podsCount(address account) public view virtual returns(uint256) {
        return _pods[account].length();
    }

    function podAt(address account, uint256 index) public view virtual returns(address) {
        return _pods[account].at(index);
    }

    function pods(address account) public view virtual returns(address[] memory) {
        return _pods[account].items.get();
    }

    function podBalanceOf(address pod, address account) public view virtual returns(uint256) {
        if (_pods[account].contains(pod)) {
            return _balanceOf(account);
        }
        return 0;
    }

    function addPod(address pod) public virtual {
        if (_addPod(msg.sender, pod) > podsLimit) revert PodsLimitReachedForAccount();
    }

    function removePod(address pod) public virtual {
        _removePod(msg.sender, pod);
    }

    function removeAllPods() public virtual {
        _removeAllPods(msg.sender);
    }

    function _addPod(address account, address pod) internal returns(uint256) {
        if (pod == address(0)) revert InvalidPodAddress();
        if (!_pods[account].add(pod)) revert PodAlreadyAdded();
        uint256 balance = _balanceOf(account);
        if (balance > 0) {
            _notifyPod(pod, address(0), account, balance);
        }
        return _pods[account].length();
    }

    function _removePod(address account, address pod) internal virtual {
        if (!_pods[account].remove(pod)) revert PodNotFound();
        uint256 balance = _balanceOf(account);
        if (balance > 0) {
            _notifyPod(pod, account, address(0), balance);
        }
    }

    function _removeAllPods(address account) internal virtual {
        address[] memory items = _pods[account].items.get();
        uint256 balance = _balanceOf(account);
        unchecked {
            for (uint256 i = items.length; i > 0; i--) {
                if (balance > 0) {
                    _notifyPod(items[i - 1], account, address(0), balance);
                }
                _pods[account].remove(items[i - 1]);
            }
        }
    }

    function _balanceOf(address account) internal view virtual returns(uint256);

    function _updatePodsBalances(address from, address to, uint256 amount) internal virtual {
        unchecked {
            if (amount > 0 && from != to) {
                address[] memory a = _pods[from].items.get();
                address[] memory b = _pods[to].items.get();
                uint256 aLength = a.length;
                uint256 bLength = b.length;

                for (uint256 i = 0; i < aLength; i++) {
                    address pod = a[i];

                    uint256 j;
                    for (j = 0; j < bLength; j++) {
                        if (pod == b[j]) {
                            // Both parties are participating of the same Pod
                            _notifyPod(pod, from, to, amount);
                            b[j] = address(0);
                            break;
                        }
                    }

                    if (j == bLength) {
                        // Sender is participating in a Pod, but receiver is not
                        _notifyPod(pod, from, address(0), amount);
                    }
                }

                for (uint256 j = 0; j < bLength; j++) {
                    address pod = b[j];
                    if (pod != address(0)) {
                        // Receiver is participating in a Pod, but sender is not
                        _notifyPod(pod, address(0), to, amount);
                    }
                }
            }
        }
    }

    /// @notice Assembly implementation of the gas limited call to avoid return gas bomb,
    // moreover call to a destructed pod would also revert even inside try-catch block in Solidity 0.8.17
    /// @dev try IPod(pod).updateBalances{gas: _POD_CALL_GAS_LIMIT}(from, to, amount) {} catch {}
    function _notifyPod(address pod, address from, address to, uint256 amount) private {
        bytes4 selector = IPod.updateBalances.selector;
        bytes4 exception = InsufficientGas.selector;
        assembly {  // solhint-disable-line no-inline-assembly
            let ptr := mload(0x40)
            mstore(ptr, selector)
            mstore(add(ptr, 0x04), from)
            mstore(add(ptr, 0x24), to)
            mstore(add(ptr, 0x44), amount)

            if lt(div(mul(gas(), 63), 64), _POD_CALL_GAS_LIMIT) {
                mstore(0, exception)
                revert(0, 4)
            }
            pop(call(_POD_CALL_GAS_LIMIT, pod, 0, ptr, 0x64, 0, 0))
        }
    }
}
