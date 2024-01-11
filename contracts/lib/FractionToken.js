'use strict';
const{
    TokenERC20Contract,
    balancePrefix,
    allowancePrefix,
    nameKey,
    symbolKey,
    decimalsKey,
    totalSupplyKey,
} = require('./tokenERC20');
class FractionToken extends TokenERC20Contract {
    constructor() {
        super('FractionToken');
        this.NFTAddress = '';
        this.NFTId = 0;
        this.NFTOwner = '';
        this.ContractDeployer = '';
        this.RoyaltyPercentage = 0;
        this.tokenOwners = [];
    }

    async init(
        ctx,
        NFTAddress,
        NFTId,
        NFTOwner,
        RoyaltyPercentage,
        supply,
        tokenName,
    ) {
        this.NFTAddress = NFTAddress;
        this.NFTId = NFTId;
        this.NFTOwner = NFTOwner;
        this.RoyaltyPercentage = RoyaltyPercentage;
        this.ContractDeployer = ctx.clientIdentity.getID();

        const nameBytes = await ctx.stub.getState(nameKey);
        if (nameBytes && nameBytes.length > 0) {
            throw new Error('contract options are already set, client is not authorized to change them');
        }

        await ctx.stub.putState(totalSupplyKey, Buffer.from(supply.toString()));
        await ctx.stub.putState(nameKey, Buffer.from(tokenName));
        await ctx.stub.putState(NFTOwner, Buffer.from(supply.toString()));
    }

    async transfer(ctx, to, amount) {
    // Calculate royalty fee
        const valueInt = parseInt(amount);

        if (valueInt < 0) {
            // transfer of 0 is allowed in ERC20, so just validate against negative amounts
            throw new Error('transfer amount cannot be negative');
        }

        const royaltyFee = (amount * this.RoyaltyPercentage) / 100;
        const afterRoyaltyFee = amount - royaltyFee;
        const owner = ctx.clientIdentity.getID();

        // Send royalty fee to owner
        await this._transfer(ctx, owner, this.NFTOwner, royaltyFee.toString());
        // Send the rest to the receiver
        await this._transfer(ctx, owner, to, afterRoyaltyFee.toString());

        return true;
    }

    async transferFrom(ctx, from, to, amount) {
    // Calculate royalty fee
        const spender = ctx.clientIdentity.getID();
        await this.Approve(ctx, from, spender, amount);
        const royaltyFee = (amount * this.RoyaltyPercentage) / 100;
        const afterRoyaltyFee = amount - royaltyFee;

        // Send royalty fee to owner
        await this._transfer(ctx, from, this.NFTOwner, royaltyFee.toString());
        // Send the rest to the receiver
        await this._transfer(ctx, from, to, afterRoyaltyFee.toString());

        return true;
    }

    async burn(ctx, amount) {
        return await this.Burn(ctx, amount);
    }

    async updateNFTOwner(ctx, newOwner) {
        if (ctx.clientIdentity.getID() !== this.ContractDeployer) {
            throw new Error('Only contract deployer can call this function');
        }

        this.NFTOwner = newOwner;
    }

    async returnTokenOwners() {
        return this.tokenOwners;
    }
}

module.exports = FractionToken;
