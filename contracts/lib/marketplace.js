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

class MarketplaceContract extends FractionTokenContract {

    async init2(ctx, name, symbol) {
        return await this.init(ctx, name, symbol);
    }

    
    /*async BalanceOfLocked(ctx) {
        const iterator = await ctx.stub.getStateByPartialCompositeKey(balancePrefix, [vault]);
        console.log(iterator)
        let balance = 0;
        let result = await iterator.next();
        while (!result.done) {
            balance++;
            result = await iterator.next();
        }

        return balance;
    }*/

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

        await this.BurnNFTb(ctx, tokenId);
        
        return true;
    }

    /*async LockNFT(ctx, tokenId) {
        const owner = ctx.clientIdentity.getID();
        if (!owner) {
            throw new Error('Failed to get the client identity ID or ID is empty');
        }

        console.log(`Owner ID: ${owner}`);
        console.log(`Vault: ${vault}`);
        console.log(`Token ID: ${tokenId}`);

        this.TransferFrom(ctx, owner, vault, tokenId);

        // Record the transfer in ownership history
        const historyKey = ctx.stub.createCompositeKey(historyPrefix, [tokenId]);
        const historyEntry = {
           previousOwner: owner,
            currentOwner: vault,
            timestamp: new Date().toISOString(),
        };
        await ctx.stub.putState(historyKey, Buffer.from(JSON.stringify(historyEntry)));

        return true;
    }*/

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



    //dokimastiko function

    async test(ctx, tokenId) {
        if (!ctx) {
            throw new Error('The context is undefined.');
        }        
        console.log(ctx)
        if (!ctx.stub || typeof ctx.stub.getState !== 'function') {
            throw new Error('The stub is undefined or getState is not available.');
        }
        let currentOwner = await this.getNFTOwner(ctx, tokenId);
        
        /*while (currentOwner !== vault) {
             this.TransferFromB(ctx, currentOwner, vault, tokenId);
    
            // Recheck the current owner after the transfer
            currentOwner = await this.getNFTOwner(ctx, tokenId);
    
            // Optional: Add a delay between retries to avoid potential rate limiting or to reduce load
            //await new Promise(resolve => setTimeout(resolve, 1000));
        }*/

        for (let i = 0; i < tokenId.length; i++) {
            await this.TransferFrom(ctx, currentOwner, vault, tokenId[i]);
        }
    }




    //idia me tin TransferFrom apla tin evala edw mesa

    async TransferFromB(ctx, from, to, tokenId) {
        // Check contract options are already set first to execute the function
        await this.CheckInitialized(ctx);

        const sender = ctx.clientIdentity.getID();

        const nft = await this._readNFT(ctx, tokenId);

        // Check if the sender is the current owner, an authorized operator,
        // or the approved client for this non-fungible token.
        const owner = nft.owner;
        const tokenApproval = nft.approved;
        const operatorApproval = await this.IsApprovedForAll(ctx, owner, sender);
        if (owner !== sender && tokenApproval !== sender && !operatorApproval) {
            throw new Error('The sender is not allowed to transfer the non-fungible token');
        }

        // Check if `from` is the current owner
        if (owner !== from) {
            throw new Error('The from is not the current owner.');
        }

        // Clear the approved client for this non-fungible token
        nft.approved = '';

        // Overwrite a non-fungible token to assign a new owner.
        nft.owner = to;
        const nftKey = ctx.stub.createCompositeKey(nftPrefix, [tokenId]);
        await ctx.stub.putState(nftKey, Buffer.from(JSON.stringify(nft)));

        // Remove a composite key from the balance of the current owner
        const balanceKeyFrom = ctx.stub.createCompositeKey(balancePrefix, [from, tokenId]);
        await ctx.stub.deleteState(balanceKeyFrom);

        // Save a composite key to count the balance of a new owner
        const balanceKeyTo = ctx.stub.createCompositeKey(balancePrefix, [to, tokenId]);
        await ctx.stub.putState(balanceKeyTo, Buffer.from('\u0000'));

        // Emit the Transfer event
        const tokenIdInt = parseInt(tokenId);
        const transferEvent = { from: from, to: to, tokenId: tokenIdInt };
        ctx.stub.setEvent('Transfer', Buffer.from(JSON.stringify(transferEvent)));

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
    


    async LockNFTAndMintFractionNFT(ctx, originalTokenId, numberOfFractions, expirationDate, fractionJson) {
        // Validation and locking of original NFT
        await this.LockNFT(ctx, originalTokenId);

        // Mint fractional NFTs
        try {
            await this.MintAndTransferSmallerTokens(ctx, originalTokenId, numberOfFractions, expirationDate, fractionJson);
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
            const owner = await this.OwnerOf(ctx, nftId, nftPrefix);
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

    async MintWithTokenURIS2(ctx, tokenId, metadata, dataHash){
        return this.MintWithTokenURI(ctx, tokenId, metadata, dataHash);
    }


}

module.exports = MarketplaceContract;
