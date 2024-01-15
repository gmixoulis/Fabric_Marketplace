/*
 * Copyright SIDROCO HOLDINGS LTD. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
*/

'use strict';

const { FractionToken } = require('./FractionToken');


const vault = 'Vault';
// const operatorAddress = 'operatorAddress'; //maybe removed
// const nftPrefix = 'nft';
// const nameKey = 'name';
// const symbolKey = 'symbol';
const historyPrefix= 'ownershipHistory';
const balancePrefix = 'balance';

class MarketplaceContract extends FractionToken {

    constructor() {
        super();
    }

    async BalanceOfLocked(ctx) {
        const iterator = await ctx.stub.getStateByPartialCompositeKey(balancePrefix, [vault]);

        let balance = 0;
        let result = await iterator.next();
        while (!result.done) {
            balance++;
            result = await iterator.next();
        }

        return balance;
    }
 
    async BurnNFT(ctx, tokenId) {

        await this.Burn(ctx, tokenId);
        
        return true;
    }

    async LockNFT(ctx, tokenId) {
        const owner = ctx.clientIdentity.getID();

        await this.TransferFrom(ctx, owner, vault, tokenId);

        // Record the transfer in ownership history
        const historyKey = ctx.stub.createCompositeKey(historyPrefix, [tokenId]);
        const historyEntry = {
            previousOwner: owner,
            currentOwner: vault,
            timestamp: new Date().toISOString(),
        };
        await ctx.stub.putState(historyKey, Buffer.from(JSON.stringify(historyEntry)));

        return true;
    }

    async UnlockNFT(ctx, tokenId) {
        // Retrieve the original owner of the NFT
        const originalOwner = await this.getNFTOwner(ctx, tokenId);

        // Transfer the NFT from the vault back to the original owner
        await this.Transfer(ctx, vault, originalOwner, tokenId);

        // Update the historical record of the NFT transfer
        const historyKey = ctx.stub.createCompositeKey(historyPrefix, [tokenId]);
        const historyEntry = {
            previousOwner: vault,
            currentOwner: originalOwner,
            timestamp: new Date().toISOString(),
        };
        await ctx.stub.putState(historyKey, Buffer.from(JSON.stringify(historyEntry)));

        return true;
    }


    async LockNFTAndMintFractionNFT(ctx, originalTokenId, numberOfFractions, fractionJson) {
        // Validation and locking of original NFT
        await this.LockNFT(ctx, originalTokenId);

        // Mint fractional NFTs
        try {
            await this.MintAndTransferSmallerTokens(ctx, originalTokenId, numberOfFractions, "", fractionJson);
            return true;
        } catch (error) {
            throw new Error(`Error while minting fractional tokens: ${error.message}`);
        }
    }

    async BuyFractionNFT(ctx, fractionTokenId, buyer) {
        try {
            await this.FractionBatchTransferFrom(ctx, this.NFTOwner, buyer, [fractionTokenId]);
            return true;
        } catch (error) {
            throw new Error(`Error while transferring fractional token: ${error.message}`);
        }
    }
    
    async getNFTOwner(ctx, nftId) {
        if (!nftId) {
            throw new Error('NFT ID is required');
        }
    
        try {
            const owner = await this.OwnerOf(ctx, nftId);
            return owner;
        } catch (error) {
            throw new Error(`Error retrieving owner for NFT ID ${nftId}: ${error.message}`);
        }
    }

}

module.exports = MarketplaceContract;
