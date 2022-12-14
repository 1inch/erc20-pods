const { expect, ether, constants } = require('@1inch/solidity-utils');
const { loadFixture } = require('@nomicfoundation/hardhat-network-helpers');
const { ethers } = require('hardhat');

function shouldBehaveLikeERC20Pods (initContracts) {
    // Behavior test scenarios
    describe('should behave like ERC20 Pods', function () {
        let wallet1, wallet2;

        before(async function () {
            [wallet1, wallet2] = await ethers.getSigners();
        });

        async function initAndMint () {
            const { erc20Pods, pods, amount } = await initContracts();
            await erc20Pods.mint(wallet1.address, amount);
            return { erc20Pods, pods, amount };
        }

        async function initAndAddAllPods () {
            const { erc20Pods, pods, amount } = await initContracts();
            for (let i = 0; i < pods.length; i++) {
                await erc20Pods.connect(wallet1).addPod(pods[i].address);
                await erc20Pods.connect(wallet2).addPod(pods[i].address);
            }
            return { erc20Pods, pods, amount };
        }

        async function initAndAddOnePod () {
            const { erc20Pods, pods, amount } = await initContracts();
            await erc20Pods.connect(wallet1).addPod(pods[0].address);
            await erc20Pods.connect(wallet2).addPod(pods[0].address);
            return { erc20Pods, pods, amount };
        };

        async function initWrongPodAndMint () {
            const { erc20Pods, amount } = await initAndMint();
            const WrongPodMock = await ethers.getContractFactory('WrongPodMock');
            const wrongPod = await WrongPodMock.deploy('WrongPodMock', 'WPM', erc20Pods.address);
            await wrongPod.deployed();
            return { erc20Pods, wrongPod, amount };
        };

        describe('view methods', function () {
            it('hasPod should return true when pod added by wallet', async function () {
                const { erc20Pods, pods } = await loadFixture(initContracts);
                await erc20Pods.addPod(pods[0].address);
                expect(await erc20Pods.hasPod(wallet1.address, pods[0].address)).to.be.equals(true);
                expect(await erc20Pods.hasPod(wallet2.address, pods[0].address)).to.be.equals(false);
            });

            it('podsCount should return pods amount which wallet using', async function () {
                const { erc20Pods, pods } = await loadFixture(initContracts);
                for (let i = 0; i < pods.length; i++) {
                    await erc20Pods.addPod(pods[i].address);
                    expect(await erc20Pods.podsCount(wallet1.address)).to.be.equals(i + 1);
                }
                for (let i = 0; i < pods.length; i++) {
                    await erc20Pods.removePod(pods[i].address);
                    expect(await erc20Pods.podsCount(wallet1.address)).to.be.equals(pods.length - (i + 1));
                }
            });

            it('podAt should return pod by added pods index', async function () {
                const { erc20Pods, pods } = await loadFixture(initContracts);
                for (let i = 0; i < pods.length; i++) {
                    await erc20Pods.addPod(pods[i].address);
                    expect(await erc20Pods.podAt(wallet1.address, i)).to.be.equals(pods[i].address);
                    expect(await erc20Pods.podAt(wallet1.address, i + 1)).to.be.equals(constants.ZERO_ADDRESS);
                }
                for (let i = pods.length - 1; i >= 0; i--) {
                    await erc20Pods.removePod(pods[i].address);
                    for (let j = 0; j < pods.length; j++) {
                        expect(await erc20Pods.podAt(wallet1.address, j))
                            .to.be.equals(
                                j >= i
                                    ? constants.ZERO_ADDRESS
                                    : pods[j].address,
                            );
                    };
                }
            });

            it('pods should return array of pods by wallet', async function () {
                const { erc20Pods, pods } = await loadFixture(initContracts);
                const podsAddrs = pods.map(pod => pod.address);
                for (let i = 0; i < pods.length; i++) {
                    await erc20Pods.addPod(pods[i].address);
                    expect(await erc20Pods.pods(wallet1.address)).to.be.deep.equals(podsAddrs.slice(0, i + 1));
                }
            });

            describe('podBalanceOf', function () {
                it('should not return balance for non-added pod', async function () {
                    const { erc20Pods, pods, amount } = await loadFixture(initAndMint);
                    expect(await erc20Pods.balanceOf(wallet1.address)).to.be.equals(amount);
                    expect(await erc20Pods.podBalanceOf(pods[0].address, wallet1.address)).to.be.equals('0');
                });

                it('should return balance for added pod', async function () {
                    const { erc20Pods, pods, amount } = await loadFixture(initAndMint);
                    await erc20Pods.addPod(pods[0].address);
                    expect(await erc20Pods.balanceOf(wallet1.address)).to.be.equals(amount);
                    expect(await erc20Pods.podBalanceOf(pods[0].address, wallet1.address)).to.be.equals(amount);
                });

                it('should not return balance for removed pod', async function () {
                    const { erc20Pods, pods, amount } = await loadFixture(initAndMint);
                    await erc20Pods.addPod(pods[0].address);
                    await erc20Pods.removePod(pods[0].address);
                    expect(await erc20Pods.balanceOf(wallet1.address)).to.be.equals(amount);
                    expect(await erc20Pods.podBalanceOf(pods[0].address, wallet1.address)).to.be.equals('0');
                });
            });
        });

        describe('addPod', function () {
            it('should not add pod with zero-address', async function () {
                const { erc20Pods } = await loadFixture(initContracts);
                await expect(erc20Pods.addPod(constants.ZERO_ADDRESS))
                    .to.be.revertedWithCustomError(erc20Pods, 'InvalidPodAddress');
            });

            it('should add pod', async function () {
                const { erc20Pods, pods } = await loadFixture(initContracts);
                expect(await erc20Pods.hasPod(wallet1.address, pods[0].address)).to.be.equals(false);
                await erc20Pods.addPod(pods[0].address);
                expect(await erc20Pods.hasPod(wallet1.address, pods[0].address)).to.be.equals(true);
            });

            it('should not add pod twice from one wallet', async function () {
                const { erc20Pods, pods } = await loadFixture(initContracts);
                await erc20Pods.addPod(pods[0].address);
                await expect(erc20Pods.addPod(pods[0].address))
                    .to.be.revertedWithCustomError(erc20Pods, 'PodAlreadyAdded');
            });

            it('should add the same pod for different wallets', async function () {
                const { erc20Pods, pods } = await loadFixture(initContracts);
                expect(await erc20Pods.hasPod(wallet1.address, pods[0].address)).to.be.equals(false);
                expect(await erc20Pods.hasPod(wallet2.address, pods[0].address)).to.be.equals(false);
                await erc20Pods.addPod(pods[0].address);
                await erc20Pods.connect(wallet2).addPod(pods[0].address);
                expect(await erc20Pods.hasPod(wallet1.address, pods[0].address)).to.be.equals(true);
                expect(await erc20Pods.hasPod(wallet2.address, pods[0].address)).to.be.equals(true);
            });

            it('should add different pod', async function () {
                const { erc20Pods, pods } = await loadFixture(initContracts);
                expect(await erc20Pods.hasPod(wallet1.address, pods[0].address)).to.be.equals(false);
                expect(await erc20Pods.hasPod(wallet1.address, pods[1].address)).to.be.equals(false);
                await erc20Pods.addPod(pods[0].address);
                await erc20Pods.addPod(pods[1].address);
                expect(await erc20Pods.pods(wallet1.address)).to.have.deep.equals([pods[0].address, pods[1].address]);
            });

            it('should updateBalance via pod only for wallets with non-zero balance', async function () {
                const { erc20Pods, pods, amount } = await loadFixture(initContracts);
                await erc20Pods.mint(wallet1.address, amount);
                // addPod for wallet with balance
                expect(await pods[0].balanceOf(wallet1.address)).to.be.equals('0');
                await erc20Pods.addPod(pods[0].address);
                expect(await pods[0].balanceOf(wallet1.address)).to.be.equals(amount);
                // addPod for wallet without balance
                expect(await pods[0].balanceOf(wallet2.address)).to.be.equals('0');
                await erc20Pods.connect(wallet2).addPod(pods[0].address);
                expect(await pods[0].balanceOf(wallet2.address)).to.be.equals('0');
            });
        });

        describe('removePod', function () {
            it('should not remove non-added pod', async function () {
                const { erc20Pods, pods } = await loadFixture(initAndAddOnePod);
                await expect(erc20Pods.removePod(pods[1].address))
                    .to.be.revertedWithCustomError(erc20Pods, 'PodNotFound');
            });

            it('should remove pod', async function () {
                const { erc20Pods, pods } = await loadFixture(initAndAddOnePod);
                expect(await erc20Pods.hasPod(wallet1.address, pods[0].address)).to.be.equals(true);
                await erc20Pods.removePod(pods[0].address);
                expect(await erc20Pods.hasPod(wallet1.address, pods[0].address)).to.be.equals(false);
            });

            it('should updateBalance via pod only for wallets with non-zero balance', async function () {
                const { erc20Pods, pods, amount } = await loadFixture(initAndAddOnePod);
                await erc20Pods.mint(wallet1.address, amount);
                await pods[0].mint(wallet2.address, amount);
                // removePod for wallet with balance
                expect(await pods[0].balanceOf(wallet1.address)).to.be.equals(amount);
                await erc20Pods.removePod(pods[0].address);
                expect(await pods[0].balanceOf(wallet1.address)).to.be.equals('0');
                // removePod for wallet without balance
                expect(await pods[0].balanceOf(wallet2.address)).to.be.equals(amount);
                await erc20Pods.connect(wallet2).removePod(pods[0].address);
                expect(await pods[0].balanceOf(wallet2.address)).to.be.equals(amount);
            });
        });

        describe('removeAllPods', function () {
            it('should remove all pods', async function () {
                const { erc20Pods, pods } = await loadFixture(initAndAddAllPods);
                expect(await erc20Pods.podsCount(wallet1.address)).to.be.equals(pods.length);
                await erc20Pods.removeAllPods();
                expect(await erc20Pods.podsCount(wallet1.address)).to.be.equals(0);
            });

            it('should updateBalance via pods only for wallets with non-zero balance', async function () {
                const { erc20Pods, pods, amount } = await loadFixture(initAndAddAllPods);
                await erc20Pods.mint(wallet1.address, amount);
                const wallet2BalancedPods = [0, 1, 5, 6, 7]; // random pods with non-zero balance on wallet2
                for (let i = 0; i < pods.length; i++) {
                    if (wallet2BalancedPods.indexOf(i) !== -1) {
                        await pods[i].mint(wallet2.address, amount);
                    }
                }
                for (let i = 0; i < pods.length; i++) {
                    expect(await pods[i].balanceOf(wallet1.address)).to.be.equals(amount);
                    expect(await pods[i].balanceOf(wallet2.address)).to.be.equals(wallet2BalancedPods.indexOf(i) !== -1 ? amount : '0');
                }
                await erc20Pods.removeAllPods();
                await erc20Pods.connect(wallet2).removeAllPods();
                for (let i = 0; i < pods.length; i++) {
                    expect(await pods[i].balanceOf(wallet1.address)).to.be.equals('0');
                    expect(await pods[i].balanceOf(wallet2.address)).to.be.equals(wallet2BalancedPods.indexOf(i) !== -1 ? amount : '0');
                }
            });
        });

        describe('_updateBalances', function () {
            it('should not fail when updateBalance in pod reverts', async function () {
                const { erc20Pods, wrongPod } = await loadFixture(initWrongPodAndMint);
                await wrongPod.setIsRevert(true);
                await erc20Pods.addPod(wrongPod.address);
                expect(await erc20Pods.pods(wallet1.address)).to.have.deep.equals([wrongPod.address]);
            });

            it('should not fail when updateBalance in pod has OutOfGas', async function () {
                const { erc20Pods, wrongPod } = await loadFixture(initWrongPodAndMint);
                await wrongPod.setOutOfGas(true);
                await erc20Pods.addPod(wrongPod.address);
                expect(await erc20Pods.pods(wallet1.address)).to.have.deep.equals([wrongPod.address]);
            });
        });

        it('should not add more pods than limit', async function () {
            const { erc20Pods, pods, extraPod } = await loadFixture(initContracts);
            const podsLimit = await erc20Pods.podsLimit();
            for (let i = 0; i < podsLimit; i++) {
                await erc20Pods.addPod(pods[i].address);
            }
            await expect(erc20Pods.addPod(extraPod.address))
                .to.be.revertedWithCustomError(erc20Pods, 'PodsLimitReachedForAccount');
        });
    });
};

function shouldBehaveLikeERC20PodsTransfers (initContracts) {
    // Behavior test scenarios
    describe('transfers should behave like ERC20 Pods transfers', function () {
        let wallet1, wallet2, wallet3;

        before(async function () {
            [wallet1, wallet2, wallet3] = await ethers.getSigners();
        });

        async function initAndMint () {
            const { erc20Pods, pods, amount } = await initContracts();
            await erc20Pods.mint(wallet1.address, amount);
            return { erc20Pods, pods, amount };
        }

        async function initAndMintAndAddPods () {
            const { erc20Pods, pods, amount } = await initAndMint();
            const podsBalancesBeforeWallet1 = [];
            for (let i = 0; i < pods.length; i++) {
                await erc20Pods.connect(wallet1).addPod(pods[i].address);
                await pods[i].mint(wallet1.address, ether(i.toString()));
                podsBalancesBeforeWallet1[i] = await pods[i].balanceOf(wallet1.address);
            }
            return { erc20Pods, pods, amount, podsBalancesBeforeWallet1 };
        };

        describe('_afterTokenTransfer', function () {
            it('should not affect when amount is zero', async function () {
                const { erc20Pods, pods, podsBalancesBeforeWallet1 } = await loadFixture(initAndMintAndAddPods);
                await erc20Pods.transfer(wallet2.address, '0');
                for (let i = 0; i < pods.length; i++) {
                    expect(await pods[i].balanceOf(wallet1.address)).to.be.equals(podsBalancesBeforeWallet1[i]);
                    expect(await pods[i].balanceOf(wallet2.address)).to.be.equals('0');
                }
            });

            it('should not affect when sender equals to recipient', async function () {
                const { erc20Pods, pods, amount, podsBalancesBeforeWallet1 } = await loadFixture(initAndMintAndAddPods);
                await erc20Pods.transfer(wallet1.address, amount);
                for (let i = 0; i < pods.length; i++) {
                    expect(await pods[i].balanceOf(wallet1.address)).to.be.equals(podsBalancesBeforeWallet1[i]);
                }
            });

            it('should not affect recipient and affect sender: recipient without pods, sender with pods', async function () {
                const { erc20Pods, pods, amount, podsBalancesBeforeWallet1 } = await loadFixture(initAndMintAndAddPods);
                const wallet1beforeBalance = await erc20Pods.balanceOf(wallet1.address);
                const wallet2beforeBalance = await erc20Pods.balanceOf(wallet2.address);
                await erc20Pods.transfer(wallet2.address, amount);
                for (let i = 0; i < pods.length; i++) {
                    expect(await pods[i].balanceOf(wallet1.address)).to.be.equals(podsBalancesBeforeWallet1[i].sub(amount));
                    expect(await pods[i].balanceOf(wallet2.address)).to.be.equals('0');
                }
                expect(await erc20Pods.balanceOf(wallet1.address)).to.be.equals(wallet1beforeBalance.sub(amount));
                expect(await erc20Pods.balanceOf(wallet2.address)).to.be.equals(wallet2beforeBalance.add(amount));
            });

            it('should affect recipient and not affect sender: recipient with pods, sender without pods', async function () {
                const { erc20Pods, pods, amount, podsBalancesBeforeWallet1 } = await loadFixture(initAndMintAndAddPods);
                await erc20Pods.mint(wallet2.address, amount);
                const wallet1beforeBalance = await erc20Pods.balanceOf(wallet1.address);
                const wallet2beforeBalance = await erc20Pods.balanceOf(wallet2.address);
                await erc20Pods.connect(wallet2).transfer(wallet1.address, amount);
                for (let i = 0; i < pods.length; i++) {
                    expect(await pods[i].balanceOf(wallet1.address)).to.be.equals(podsBalancesBeforeWallet1[i].add(amount));
                    expect(await pods[i].balanceOf(wallet2.address)).to.be.equals('0');
                }
                expect(await erc20Pods.balanceOf(wallet1.address)).to.be.equals(wallet1beforeBalance.add(amount));
                expect(await erc20Pods.balanceOf(wallet2.address)).to.be.equals(wallet2beforeBalance.sub(amount));
            });

            it('should not affect recipient and sender: recipient without pods, sender without pods', async function () {
                const { erc20Pods, pods, amount } = await loadFixture(initAndMintAndAddPods);
                await erc20Pods.mint(wallet2.address, amount);
                const wallet2beforeBalance = await erc20Pods.balanceOf(wallet2.address);
                const wallet3beforeBalance = await erc20Pods.balanceOf(wallet3.address);
                await erc20Pods.connect(wallet2).transfer(wallet3.address, amount);
                for (let i = 0; i < pods.length; i++) {
                    expect(await pods[i].balanceOf(wallet2.address)).to.be.equals('0');
                    expect(await pods[i].balanceOf(wallet3.address)).to.be.equals('0');
                }
                expect(await erc20Pods.balanceOf(wallet2.address)).to.be.equals(wallet2beforeBalance.sub(amount));
                expect(await erc20Pods.balanceOf(wallet3.address)).to.be.equals(wallet3beforeBalance.add(amount));
            });

            it('should affect recipient and sender with different pods', async function () {
                const { erc20Pods, pods, amount } = await loadFixture(initAndMintAndAddPods);
                await erc20Pods.mint(wallet2.address, amount);

                const podsBalancesBeforeWallet2 = [];
                const podsBalancesBeforeWallet3 = [];
                for (let i = 0; i < pods.length; i++) {
                    if (i <= pods.length / 2 + 2) {
                        await erc20Pods.connect(wallet2).addPod(pods[i].address);
                        await pods[i].mint(wallet2.address, ether((i + 1).toString()));
                    }
                    if (i >= pods.length / 2 - 2) {
                        await erc20Pods.connect(wallet3).addPod(pods[i].address);
                        await pods[i].mint(wallet3.address, ether((i + 1).toString()));
                    }
                    podsBalancesBeforeWallet2[i] = await pods[i].balanceOf(wallet2.address);
                    podsBalancesBeforeWallet3[i] = await pods[i].balanceOf(wallet3.address);
                }

                const wallet2beforeBalance = await erc20Pods.balanceOf(wallet2.address);
                const wallet3beforeBalance = await erc20Pods.balanceOf(wallet3.address);

                await erc20Pods.connect(wallet2).transfer(wallet3.address, amount);

                for (let i = 0; i < pods.length; i++) {
                    expect(await pods[i].balanceOf(wallet2.address))
                        .to.be.equals(
                            i <= pods.length / 2 + 2
                                ? podsBalancesBeforeWallet2[i].sub(amount)
                                : '0',
                        );
                    expect(await pods[i].balanceOf(wallet3.address))
                        .to.be.equals(
                            i >= pods.length / 2 - 2
                                ? podsBalancesBeforeWallet3[i].add(amount)
                                : '0',
                        );
                }
                expect(await erc20Pods.balanceOf(wallet2.address)).to.be.equals(wallet2beforeBalance.sub(amount));
                expect(await erc20Pods.balanceOf(wallet3.address)).to.be.equals(wallet3beforeBalance.add(amount));
            });
        });
    });
};

module.exports = {
    shouldBehaveLikeERC20Pods,
    shouldBehaveLikeERC20PodsTransfers,
};
