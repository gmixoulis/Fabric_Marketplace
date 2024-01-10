'use strict';

const { Context } = require('fabric-contract-api');
const { ChaincodeStub, ClientIdentity } = require('fabric-shim');
const sinon = require('sinon');
const expect = require('chai').expect;
const { FractionToken } = require('../lib/FractionToken');

describe('FractionToken', () => {
    let sandbox;
    let token;
    let ctx;
    let mockStub;
    let mockClientIdentity;

    beforeEach('Sandbox creation', async () => {
        sandbox = sinon.createSandbox();
        token = new FractionToken();

        ctx = sinon.createStubInstance(Context);
        mockStub = sinon.createStubInstance(ChaincodeStub);
        ctx.stub = mockStub;
        mockClientIdentity = sinon.createStubInstance(ClientIdentity);
        mockClientIdentity.getMSPID.returns('Org1MSP');
        ctx.clientIdentity = mockClientIdentity;

        await token.init(ctx, 'NFTAddress', 'NFTId', 'NFTOwner', 10, 1000, 'TokenName', 'TKN');

        mockStub.putState.resolves('some state');
        mockStub.setEvent.returns('set event');
        mockStub.getState.resolves('some state');
    });

    afterEach('Sandbox restoration', () => {
        sandbox.restore();
    });

    describe('#init', () => {
        it('should initialize the contract', async () => {
            sinon.assert.calledWith(mockStub.putState, 'totalSupply', Buffer.from('1000'));
            sinon.assert.calledWith(mockStub.putState, 'tokenName', Buffer.from('TokenName'));
            sinon.assert.calledWith(mockStub.putState, 'tokenTicker', Buffer.from('TKN'));
            sinon.assert.calledWith(mockStub.putState, 'NFTOwner', Buffer.from('1000'));
        });

        it('should fail if called a second time', async () => {
            await expect(token.init(ctx, 'NFTAddress', 'NFTId', 'NFTOwner', 10, 1000, 'TokenName', 'TKN'))
                .to.be.rejectedWith(Error, 'contract options are already set, client is not authorized to change them');
        });
    });

    describe('#transfer', () => {
        it('should transfer tokens with royalty fee', async () => {
            mockClientIdentity.getID.returns('Owner');
            sinon.stub(token, '_transfer').returns(true);

            const response = await token.transfer(ctx, 'Receiver', '100');
            sinon.assert.calledWith(mockStub.setEvent, 'Transfer', sinon.match.any);
            expect(response).to.equal(true);
        });
    });

    describe('#transferFrom', () => {
        it('should transfer tokens with royalty fee', async () => {
            mockClientIdentity.getID.returns('Spender');
            sinon.stub(token, '_transfer').returns(true);
            sinon.stub(token, 'Approve').returns(true);

            const response = await token.transferFrom(ctx, 'Owner', 'Receiver', '100');
            sinon.assert.calledWith(mockStub.setEvent, 'Transfer', sinon.match.any);
            expect(response).to.equal(true);
        });
    });

    describe('#burn', () => {
        it('should burn tokens', async () => {
            sinon.stub(token, '_transfer').returns(true);

            const response = await token.burn(ctx, '100');
            sinon.assert.calledWith(mockStub.putState, 'totalSupply', Buffer.from('900'));
            sinon.assert.calledWith(mockStub.setEvent, 'Transfer', sinon.match.any);
            expect(response).to.equal(true);
        });
    });

    describe('#updateNFTOwner', () => {
        it('should update NFT owner', async () => {
            mockClientIdentity.getID.returns('ContractDeployer');

            const response = await token.updateNFTOwner(ctx, 'NewOwner');
            expect(token.NFTOwner).to.equal('NewOwner');
            expect(response).to.equal(undefined);
        });

        it('should fail for non-contract deployer', async () => {
            mockClientIdentity.getID.returns('NonDeployer');
            await expect(token.updateNFTOwner(ctx, 'NewOwner'))
                .to.be.rejectedWith(Error, 'Only contract deployer can call this function');
        });
    });

    describe('#returnTokenOwners', () => {
        it('should return token owners', async () => {
            const owners = await token.returnTokenOwners();
            expect(owners).to.deep.equal([]);
        });
    });
});
