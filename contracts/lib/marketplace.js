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

    async getNFTDetails(ctx, nftId) {
        if (!nftId) {
            throw new Error('NFT ID is required');
        }
    
        const nftKey = ctx.stub.createCompositeKey(nftPrefix, [nftId]);
        const nftDetailsBuffer = await ctx.stub.getState(nftKey);
    
        if (!nftDetailsBuffer || nftDetailsBuffer.length === 0) {
            throw new Error(`NFT with ID ${nftId} does not exist`);
        }
    
        const nftDetails = JSON.parse(nftDetailsBuffer.toString());
        return nftDetails;
    }
    
    async getFractionalNFTDetails(ctx, fractionTokenId) {
        if (!fractionTokenId) {
            throw new Error('Fractional Token ID is required');
        }
    
        const fractionKey = ctx.stub.createCompositeKey(fractionPrefix, [fractionTokenId]);
        const fractionDetailsBuffer = await ctx.stub.getState(fractionKey);
    
        if (!fractionDetailsBuffer || fractionDetailsBuffer.length === 0) {
            throw new Error(`Fractional Token with ID ${fractionTokenId} does not exist`);
        }
    
        const fractionDetails = JSON.parse(fractionDetailsBuffer.toString());
        return fractionDetails;
    }
    

    async getNFTOwnershipHistory(ctx, nftId) {
        if (!nftId) {
            throw new Error('NFT ID is required');
        }
    
        const historyIterator = await ctx.stub.getStateByPartialCompositeKey(historyPrefix, [nftId]);
        const ownershipHistory = [];
    
        let result = await historyIterator.next();
        while (!result.done) {
            const response = result.value;
            if (response) {
                const record = JSON.parse(response.value.toString('utf8'));
                ownershipHistory.push(record);
            }
            result = await historyIterator.next();
        }
    
        await historyIterator.close();
    
        if (ownershipHistory.length === 0) {
            throw new Error(`No ownership history found for NFT ID ${nftId}`);
        }
    
        return ownershipHistory;
    }

    async getAllNFTsInVault(ctx) {
        const iterator = await ctx.stub.getStateByPartialCompositeKey(historyPrefix, [vault]);
        const nftsInVault = [];
    
        let result = await iterator.next();
        while (!result.done) {
            const response = result.value;
            if (response) {
                const record = JSON.parse(response.value.toString('utf8'));
                if (record.currentOwner === vault) {
                    nftsInVault.push({ tokenId: response.key, ...record });
                }
            }
            result = await iterator.next();
        }
    
        await iterator.close();
    
        return nftsInVault;
    }
    
    async getUserSpecificData(ctx, userId) {
        if (!userId) {
            throw new Error('User ID is required');
        }
    
        const iterator = await ctx.stub.getStateByPartialCompositeKey(balancePrefix, [userId]);
        const userNFTs = [];
    
        let result = await iterator.next();
        while (!result.done) {
            const response = result.value;
            if (response) {
                const tokenId = ctx.stub.splitCompositeKey(response.key).attributes[1];
                userNFTs.push(tokenId);
            }
            result = await iterator.next();
        }
    
        await iterator.close();
    
        if (userNFTs.length === 0) {
            throw new Error(`No NFTs found for user ID ${userId}`);
        }
    
        return userNFTs;
    }


}

module.exports = MarketplaceContract;
