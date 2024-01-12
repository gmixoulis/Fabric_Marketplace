/*
 * Copyright SIDROCO HOLDINGS LTD. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
*/

'use strict';

const { Contract } = require('fabric-contract-api');
const { TokenERC721Contract, Transfer } = require('./tokenERC721');
const { FractionToken } = require('./FractionToken');


const vault = 'Vault';
// const operatorAddress = 'operatorAddress'; //maybe removed
// const nftPrefix = 'nft';
// const nameKey = 'name';
// const symbolKey = 'symbol';
const historyPrefix= 'ownershipHistory';
const balancePrefix = 'balance';

class MarketplaceContract extends Contract {

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
    
        // Calling the Burn function from TokenERC721Contract
        await Burn(ctx, tokenId);
        
        return true;
    }

    async LockNFT(ctx, tokenId) {
        const owner = ctx.clientIdentity.getID();
        //const channel = await ctx.stub.getChannelID();

        //await ctx.stub.invokeChaincode('marketplace', ['TransferFrom', owner, vault, tokenId], channel);
        await TransferFrom(ctx, owner, vault, tokenId)

        const historyKey = ctx.stub.createCompositeKey(historyPrefix, [tokenId]);
        const historyEntry = {
            previousOwner: owner,
            currentOwner: 'Vault', // Assuming the vault is the new owner
            timestamp: new Date().toISOString(),
        };

        await ctx.stub.putState(historyKey, Buffer.from(JSON.stringify(historyEntry)));

        return true;
    }

    async UnlockNFT(ctx, tokenId) {
        // Retrieve the original owner of the NFT
        const originalOwner = await this.getNFTOwner(ctx, tokenId);
        if (!originalOwner) {
            throw new Error(`No owner found for NFT with ID ${tokenId}`);
        }
    
        // Transfer the NFT from the vault back to the original owner
        await Transfer(ctx, vault, originalOwner, tokenId);
    
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
        
        if (!originalTokenId || numberOfFractions <= 0 || !fractionJson) {
            throw new Error('Invalid input parameters');
        }
    
        await this.LockNFT(ctx, originalTokenId);
    
        // Mint fractional NFTs
        const fractionToken = new FractionToken();
        const expirationDate = ""; // ??
        try {
            await fractionToken.MintAndTransferSmallerTokens(ctx, originalTokenId, numberOfFractions, expirationDate, fractionJson);
            return true;
        } catch (error) {
            throw new Error(`Error while minting fractional tokens: ${error.message}`);
        }
    }
    

    async BuyFractionNFT(ctx, fractionTokenId, buyer) {

        if (!fractionTokenId || !buyer) {
            throw new Error('Invalid input parameters');
        }

        const fractionToken = new FractionToken();
        const currentOwner = await fractionToken.OwnerOf(ctx, fractionTokenId);

        // Transfer the fraction NFT to the buyer using FractionBatchTransferFrom
        try {
            await fractionToken.FractionBatchTransferFrom(ctx, currentOwner, buyer, [fractionTokenId]);
            return true;
        } catch (error) {
            throw new Error(`Error while transferring fractional token: ${error.message}`);
        }
    }
    
    async getNFTOwner(ctx, nftId) {

        if (!nftId) {
            throw new Error('NFT ID is required');
        }

        const erc721 = new TokenERC721Contract();

        // Call the OwnerOf function
        try {
            const owner = await erc721.OwnerOf(ctx, nftId);
            return owner;
        } catch (error) {
            throw new Error(`Error retrieving owner for NFT ID ${nftId}: ${error.message}`);
        }
    }


}

module.exports = MarketplaceContract;
