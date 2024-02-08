/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
*/

'use strict';

const { Context } = require('fabric-contract-api');
const { ChaincodeStub, ClientIdentity } = require('fabric-shim');

const { TokenERC20Contract ,tokenERC721Contract, marketplaceContract} = require('..');

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const sinon = require('sinon');
const expect = chai.expect;

chai.should();
chai.use(chaiAsPromised);

describe('Marketplace', () => {
    let sandbox;
    let token721;
    let token20;
    let marketplace;
    let ctx;
    let mockStub;
    let mockClientIdentity;

    beforeEach('Sandbox creation', async() => {
        sandbox = sinon.createSandbox();
        token721 = new tokenERC721Contract('token-erc721');
        token20 = new TokenERC20Contract('token-erc20');
        marketplace = new marketplaceContract('marketplace');

        ctx = sinon.createStubInstance(Context);
        mockStub = sinon.createStubInstance(ChaincodeStub);
        ctx.stub = mockStub;
        mockClientIdentity = sinon.createStubInstance(ClientIdentity);
        mockClientIdentity.getMSPID.returns('Org1MSP');
        ctx.clientIdentity = mockClientIdentity;

        // await token721.Initialize(ctx,'some name','some symbol');
        // await token20.Initialize(ctx, 'some name', 'some symbol', '100');

        mockStub.putState.resolves('some state');
        mockStub.getState.resolves('some state');
        mockStub.getChannelID.resolves('fl-channel');

        // sinon.assert.calledWith(mockStub.putState.getCall(0), 'name', Buffer.from(('some name')));
        // sinon.assert.calledWith(mockStub.putState.getCall(1), 'symbol', Buffer.from(('some symbol')));
        // sinon.assert.calledWith(mockStub.putState.getCall(2), 'name', Buffer.from(('some name')));
        // sinon.assert.calledWith(mockStub.putState.getCall(3), 'symbol', Buffer.from(('some symbol')));
        // sinon.assert.calledWith(mockStub.putState.getCall(4), 'decimals', Buffer.from(('100')));
    });

    afterEach('Sandbox restoration', () => {
        sandbox.restore();
    });

    describe('#TokenName', () => {
        it('should work', async () => {
            mockStub.getState.resolves('some state');

            const responseToken20 = await token20.TokenName(ctx);
            const responseToken721 = await token721.Name(ctx);

            sinon.assert.calledWith(mockStub.getState, 'name');
            expect(responseToken20).to.equals('some state');
            expect(responseToken721).to.equals('some state');
        });
    });

    describe('#Symbol', () => {
        it('should work', async () => {
            mockStub.getState.resolves('some state');

            const responseToken20 = await token20.Symbol(ctx);
            const responseToken721 = await token721.Symbol(ctx);

            sinon.assert.calledWith(mockStub.getState, 'symbol');
            expect(responseToken20).to.equals('some state');
            expect(responseToken721).to.equals('some state');
        });
    });

    describe('#LockNFT', () => {
        it('should work', async () => {
            const tokenId = '101';
            const owner = 'Alice';
            const vault = 'Vault';
            const historyPrefix= 'ownershipHistory';
            mockClientIdentity.getID.returns('Alice');

            const historyEntry = {
                previousOwner: owner,
                currentOwner: vault,
                timestamp: new Date().toISOString(),
            };

            // Stub the invokeChaincode function to return the expected historyEntry
            // invokeStub.withArgs('token-erc721', ['TransferFrom', owner, vault, tokenId], 'fl-channel').resolves();
            mockStub.invokeChaincode.withArgs('token-erc721', ['TransferFrom', owner, vault, tokenId]).returns(true);
            mockStub.createCompositeKey.withArgs(historyPrefix, [tokenId]).returns(`${historyPrefix}_${tokenId}`);
            // Stub the putState function to return the expected result
            // const putStateStub = sinon.stub(context.stub, 'putState').resolves();

            // Call the LockNFT function
            const result = await marketplace.LockNFT(ctx, tokenId);

            // Assertions
            sinon.assert.calledOnce(mockStub.invokeChaincode);
            sinon.assert.calledWith(
                mockStub.invokeChaincode,
                'token-erc721',
                ['TransferFrom', owner, vault, tokenId],
                'fl-channel'
            );

            sinon.assert.calledOnce(mockStub.putState);

            sinon.assert.calledWith(
                mockStub.putState,
                sinon.match(`${historyPrefix}_${tokenId}`),
                sinon.match((buffer) => {
                    const storedEntry = JSON.parse(buffer.toString());
                    // You may need to adjust the comparison based on your timestamp generation logic
                    return storedEntry.previousOwner === historyEntry.previousOwner &&
                           storedEntry.currentOwner === historyEntry.currentOwner;
                })
            );

            expect(result).to.be.true;

            // Restore the stubs
            mockStub.invokeChaincode.restore();
            mockStub.putState.resolves().restore();
        });
    });

});
