"use strict";

const { Context } = require("fabric-contract-api");
const { ChaincodeStub, ClientIdentity } = require("fabric-shim");
const FractionToken = require("./FractionToken"); // Import your FractionToken contract here

const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");
const sinon = require("sinon");
const expect = chai.expect;

chai.should();
chai.use(chaiAsPromised);

describe("FractionToken", () => {
  let sandbox;
  let fractionToken;
  let ctx;
  let mockStub;
  let mockClientIdentity;

  beforeEach("Sandbox creation", async () => {
    sandbox = sinon.createSandbox();
    fractionToken = new FractionToken();

    ctx = sinon.createStubInstance(Context);
    mockStub = sinon.createStubInstance(ChaincodeStub);
    ctx.stub = mockStub;
    mockClientIdentity = sinon.createStubInstance(ClientIdentity);
    mockClientIdentity.getMSPID.returns("Org1MSP");
    ctx.clientIdentity = mockClientIdentity;

    await fractionToken.init(
      ctx,
      "NFTAddress",
      "NFTId",
      "NFTOwner",
      10, // RoyaltyPercentage
      10000, // supply
      "TokenName",
      "TokenTicker"
    );

    mockStub.putState.resolves("some state");
    mockStub.setEvent.returns("set event");
    mockStub.getState.resolves("some state");
  });

  afterEach("Sandbox restoration", () => {
    sandbox.restore();
  });

  describe("#init", () => {
    it("should initialize the contract", async () => {
      // Ensure that contract properties are set correctly
      expect(fractionToken.NFTAddress).to.equal("NFTAddress");
      expect(fractionToken.NFTId).to.equal("NFTId");
      expect(fractionToken.NFTOwner).to.equal("NFTOwner");
      expect(fractionToken.RoyaltyPercentage).to.equal(10);

      // Ensure that state variables are set correctly
      sinon.assert.calledWith(
        mockStub.putState.getCall(0),
        "totalSupply",
        Buffer.from("10000")
      );
      sinon.assert.calledWith(
        mockStub.putState.getCall(1),
        "tokenName",
        Buffer.from("TokenName")
      );
      sinon.assert.calledWith(
        mockStub.putState.getCall(2),
        "tokenTicker",
        Buffer.from("TokenTicker")
      );
      sinon.assert.calledWith(
        mockStub.putState.getCall(3),
        "NFTOwner",
        Buffer.from("10000")
      );
    });

    it("should not allow re-initialization", async () => {
      // Attempt to initialize the contract again
      await expect(
        fractionToken.init(
          ctx,
          "NFTAddress",
          "NFTId",
          "NFTOwner",
          10,
          10000,
          "TokenName",
          "TokenTicker"
        )
      ).to.be.rejectedWith(Error, "contract is already initialized");
    });
  });

  describe("#transfer", () => {
    it("should transfer tokens with royalty fee", async () => {
      // Mock the _transfer function to simulate a successful transfer
      sinon.stub(fractionToken, "_transfer").returns(true);

      // Perform the transfer
      const response = await fractionToken.transfer(ctx, "Recipient", "1000");

      // Ensure that _transfer was called correctly
      sinon.assert.calledWith(
        fractionToken._transfer,
        ctx,
        "Sender",
        "NFTOwner",
        "100"
      );

      // Ensure that the remaining amount was transferred to the recipient
      sinon.assert.calledWith(
        fractionToken._transfer,
        ctx,
        "Sender",
        "Recipient",
        "900"
      );

      // Verify the response
      expect(response).to.equal(true);
    });

    // You can add more test cases for transfer here
  });

  describe("#transferFrom", () => {
    it("should transfer tokens from allowance with royalty fee", async () => {
      // Mock the _transfer function to simulate a successful transfer
      sinon.stub(fractionToken, "_transfer").returns(true);

      // Mock the Approve function to simulate an approval
      sinon.stub(fractionToken, "Approve").returns(true);

      // Perform the transferFrom
      const response = await fractionToken.transferFrom(
        ctx,
        "From",
        "Recipient",
        "1000"
      );

      // Ensure that the Approve function was called correctly
      sinon.assert.calledWith(
        fractionToken.Approve,
        ctx,
        "From",
        "Sender",
        "1000"
      );

      // Ensure that _transfer was called correctly
      sinon.assert.calledWith(
        fractionToken._transfer,
        ctx,
        "From",
        "NFTOwner",
        "100"
      );

      // Ensure that the remaining amount was transferred to the recipient
      sinon.assert.calledWith(
        fractionToken._transfer,
        ctx,
        "From",
        "Recipient",
        "900"
      );

      // Verify the response
      expect(response).to.equal(true);
    });

    // You can add more test cases for transferFrom here
  });

  describe("#burn", () => {
    it("should burn tokens", async () => {
      // Mock the Burn function to simulate a successful burn
      sinon.stub(fractionToken, "Burn").returns(true);

      // Perform the burn
      const response = await fractionToken.burn(ctx, "1000");

      // Ensure that Burn was called correctly
      sinon.assert.calledWith(fractionToken.Burn, ctx, "1000");

      // Verify the response
      expect(response).to.equal(true);
    });

    // You can add more test cases for burn here
  });

  describe("#updateNFTOwner", () => {
    it("should update the NFTOwner if called by the ContractDeployer", async () => {
      // Set the ContractDeployer to match the client identity
      fractionToken.ContractDeployer = ctx.clientIdentity.getID();

      // Call the updateNFTOwner function
      await fractionToken.updateNFTOwner(ctx, "NewOwner");

      // Ensure that the NFTOwner was updated correctly
      expect(fractionToken.NFTOwner).to.equal("NewOwner");
    });

    it("should not allow updating NFTOwner if not called by the ContractDeployer", async () => {
      // Attempt to update NFTOwner by a different identity
      await expect(
        fractionToken.updateNFTOwner(ctx, "NewOwner")
      ).to.be.rejectedWith(
        Error,
        "Only contract deployer can call this function"
      );
    });

    // You can add more test cases for updateNFTOwner here
  });

  // You can add more test cases for other functions in the FractionToken contract as needed
});
