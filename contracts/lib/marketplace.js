/*
 * Copyright SIDROCO HOLDINGS LTD. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
*/

'use strict';
const { FractionTokenContract } = require('./FractionToken');


const vault = 'Vault';
// const operatorAddress = 'operatorAddress'; //maybe removed
const nftPrefix = 'nft';
// const nameKey = 'name';
// const symbolKey = 'symbol';
const historyPrefix= 'ownershipHistory';
const balancePrefix = 'balance';
const balanceFractionPrefix = 'fractionBalance';
const fractionPrefix = 'fraction';
const expirationPrefix = 'expiration'

class MarketplaceContract extends FractionTokenContract {

    async init2(ctx, name, symbol) {
        return await this.init(ctx, name, symbol);
    }

    async BalanceOfLocked(ctx) {
        const iterator = await ctx.stub.getStateByPartialCompositeKey(balancePrefix, [vault]);
        if (!iterator) {
            throw new Error('Failed to retrieve NFTs from the vault.');
        }
    
        let balance = 0;
        try {
            let result = await iterator.next();
            while (!result.done) {
                // Assuming each entry in the iterator represents an NFT locked in the vault
                balance++;
                result = await iterator.next();
            }
        } finally {
            // Always close the iterator to release resources
            await iterator.close();
        }
    
        console.log(`Total NFTs locked in the vault: ${balance}`);
        return balance;
    }
    
 
    async BurnNFT(ctx, tokenId) {

        await this.Burn(ctx, tokenId);
        
        return true;
    }


    async LockNFT(ctx, tokenId) {
        if (!tokenId) {
            throw new Error('Token ID is required for locking an NFT.');
        }
    
        const currentOwner = await this.getNFTOwner(ctx, tokenId);
        if (!currentOwner) {
            throw new Error(`No owner found for Token ID: ${tokenId}`);
        }
    
        const requester = ctx.clientIdentity.getID();
        if (requester !== currentOwner) {
            throw new Error('Only the owner can lock their NFT.');
        }
    
        // Log the operation details
        console.log(`Locking NFT: Owner ID: ${currentOwner}, Vault: ${vault}, Token ID: ${tokenId}`);
        console.log(typeof currentOwner); // Should output 'string'
        if (!currentOwner || currentOwner.trim().length === 0) {
            throw new Error('currentOwner is not a valid string');
        }
        console.log(`tokenId: '${tokenId}'`); // This will show if tokenId is empty or not a string



        // Transfer the NFT to the vault
        await this.TransferFrom(ctx, currentOwner, vault, tokenId);
    
        // Record the transfer in ownership history
        const historyKey = ctx.stub.createCompositeKey(historyPrefix, [tokenId]);
        const historyEntry = {
            previousOwner: currentOwner,
            currentOwner: vault,
            timestamp: new Date().toISOString(),
        };
        await ctx.stub.putState(historyKey, Buffer.from(JSON.stringify(historyEntry)));
    
        return `NFT with Token ID ${tokenId} has been locked in the vault.`;
    }

    async UnlockNFT(ctx, tokenId) {

        const caller = ctx.clientIdentity.getID();
    
        //todo: elegxos prin burn gia ton previous owner ktl

        // Check if the caller owns all fractions of the NFT
        const fractionOwnership = await this.verifyFractionOwnership(ctx, tokenId, caller);
        if (!fractionOwnership) {
            throw new Error('Caller does not own all fractions of the NFT.');
        }
    
        // Burn all fractional tokens
        const numberOfFractions = await this.countFractionalTokens(ctx, tokenId);
        for (let i = 1; i <= numberOfFractions; i++) {
            const fractionTokenId = `${tokenId}-${i}`;
            await this.Burn(ctx, fractionTokenId, fractionPrefix);
        }


    
        // Transfer the original NFT from the vault to the caller
        await this.Unlock(ctx, vault, caller, tokenId);
    
        // Update the ownership history
        const historyKey = ctx.stub.createCompositeKey(historyPrefix, [tokenId]);
        const historyEntry = {
            previousOwner: vault,
            currentOwner: caller,
            timestamp: new Date().toISOString(),
        };
        await ctx.stub.putState(historyKey, Buffer.from(JSON.stringify(historyEntry)));
    
        return `Original NFT with Token ID ${tokenId} has been unlocked and transferred to ${caller}`;
    }
    
    async verifyFractionOwnership(ctx, originalTokenId, owner) {
        let ownsAllFractions = true;
        let fractionCounter = 1;
    
        while (true) {
            const fractionTokenId = `${originalTokenId}-${fractionCounter}`;
            try {
                const fractionOwner = await this.OwnerOf(ctx, fractionTokenId, fractionPrefix);
                console.log(fractionOwner)
                if (fractionOwner !== owner) {
                    ownsAllFractions = false;
                    break;
                }
            } catch (error) {
                // Break the loop if the fractional NFT does not exist
                break;
            }
            fractionCounter++;
        }
    
        return ownsAllFractions;
    }
    
    
    

    async MintFractionNFT(ctx, originalTokenId, numberOfFractions, fractionJson) {

        try {
            await this.MintAndTransferSmallerTokens(ctx, originalTokenId, numberOfFractions, fractionJson);
            return true;
        } catch (error) {
            throw new Error(`Error while minting fractional tokens: ${error.message}`);
        }
    }

    async SellFractionNFT(ctx, fractionTokenId, buyer, expirationPeriodInSeconds) {

        const currentOwner = await this.getFractionNFTOwner(ctx, fractionTokenId);

        if (!currentOwner) {
            throw new Error(`No owner found for Token ID: ${fractionTokenId}`);
        }

        const requester = ctx.clientIdentity.getID();
        if (requester !== currentOwner) {
            throw new Error('Only the owner can sell their NFT.');
        }

        try {
            await this.TransferFractionFrom(ctx, currentOwner, buyer, fractionTokenId);
        } catch (error) {
            throw new Error(`Error while transferring fractional token: ${error.message}`);
        }

        const originalOwner = currentOwner;

        // Record history
        const historyKey = ctx.stub.createCompositeKey(historyPrefix, [fractionTokenId]);
        const historyEntry = {
            previousOwner: originalOwner,
            currentOwner: buyer,
            timestamp: new Date().toISOString(),
        };
        await ctx.stub.putState(historyKey, Buffer.from(JSON.stringify(historyEntry)));

        // Calculate expiration date as the current time plus the duration provided
        //const date = new Date().toISOString();
        const timestamp = Math.floor(Date.now() / 1000); // Current timestamp in seconds


        const expirationPeriod = expirationPeriodInSeconds;
        console.log(timestamp)
        console.log(expirationPeriodInSeconds)

        // Record the expiration entry with a timestamp and expiration period
        const expirationKey = ctx.stub.createCompositeKey(expirationPrefix, [fractionTokenId]);
        const expirationEntry = {
            timestamp: timestamp, // The timestamp when the NFT was sold
            expirationPeriod: parseInt(expirationPeriod, 10), // Convert the expiration period to an integer
        };
        await ctx.stub.putState(expirationKey, Buffer.from(JSON.stringify(expirationEntry)));

        return true;

    }

    async ReclaimExpiredNFT(ctx, fractionTokenId) {
        
        const caller = ctx.clientIdentity.getID();

        // Transfer the NFT back to the original owner
        try {
            await this.TransferExpiredFractionBack(ctx, ctx.clientIdentity.getID(), caller, fractionTokenId);
        } catch (error) {
            throw new Error(`Error while transferring the FractionNFT back to the original owner: ${error.message}`);
        }
    
        return true;
    }
    
    

    async TransferNFT(ctx, tokenId, receiver){

        const currentOwner = await this.getNFTOwner(ctx, tokenId);
        if (!currentOwner) {
            throw new Error(`No owner found for Token ID: ${tokenId}`);
        }

        const requester = ctx.clientIdentity.getID();
        if (requester !== currentOwner) {
            throw new Error('Only the owner can send their NFT.');
        }

        await this.TransferFrom(ctx, currentOwner, receiver, tokenId);

        const originalOwner = currentOwner;

        const historyKey = ctx.stub.createCompositeKey(historyPrefix, [tokenId]);
        const historyEntry = {
            previousOwner: vault,
            currentOwner: originalOwner,
            timestamp: new Date().toISOString(),
        };
        await ctx.stub.putState(historyKey, Buffer.from(JSON.stringify(historyEntry)));

        return true;
    }
    
    async getNFTOwner(ctx, nftId) {
        if (!nftId) {
            throw new Error('NFT ID is required');
        }
    
        try {
            const owner = await this.OwnerOf(ctx, nftId, nftPrefix);
            return owner;
        } catch (error) {
            throw new Error(`Error retrieving owner for NFT ID ${nftId}: ${error.message}`);
        }
    }

    async getFractionNFTOwner(ctx, nftId) {
        if (!nftId) {
            throw new Error('NFT ID is required');
        }
    
        try {
            const owner = await this.OwnerOf(ctx, nftId, fractionPrefix);
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
        // Create an iterator for all tokens based on the balancePrefix and vault
        const iterator = await ctx.stub.getStateByPartialCompositeKey(balancePrefix, [vault]);
        let nftsInVault = [];
    
        let result = await iterator.next();
        while (!result.done) {
            const response = result.value;
            if (response) {
                // Extract the tokenId from the composite key
                const tokenId = ctx.stub.splitCompositeKey(response.key).attributes[1];
                try {
                    const currentOwner = await this.getNFTOwner(ctx, tokenId);
    
                    if (currentOwner === vault) {
                        nftsInVault.push(tokenId);
                    }
                } catch (error) {
                    console.error(`Failed to get owner for Token ID ${tokenId}: ${error}`);
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

    async MintWithTokenURIS2(ctx, tokenId, metadata, dataHash){
        return this.MintWithTokenURI(ctx, tokenId, metadata, dataHash);
    }

    async NFTBalanceOf (ctx, userId) {
        return this.BalanceOf(ctx, userId, balancePrefix);
    }

    async FractionNFTBalanceOf (ctx, userId) {
        return this.BalanceOf(ctx, userId, balanceFractionPrefix);
    }


}

module.exports = MarketplaceContract;
