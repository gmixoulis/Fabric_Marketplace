'use strict';
const{
    TokenERC721Contract,
    balancePrefix,
    nameKey,
    symbolKey,
    nftPrefix,
    approvalPrefix
} = require('./tokenERC721');
const crypto = require('crypto');

const historyPrefix= 'ownershipHistory';


// const fractionPrefix = 'FRACTION';
const vault = 'Vault';

class FractionTokenContract extends TokenERC721Contract {

    async init(ctx, name, symbol) {
        return await this.Initialize(ctx, name, symbol);
    }

    async FractionBatchTransferFrom(ctx, from, to, tokenIds) {
        for (let i = 0; i < tokenIds.length; i++) {
            await this.FractionTransferFrom(ctx, from, to, tokenIds[i]);
        }

        return true;
    }

    async FractionsMintWithTokenURI(ctx, tokenIds, metadatas, datahash){
        await Promise.all(
            tokenIds.map(async (tokenId,index) => {
                await this.MintFractionWithTokenURI(ctx, tokenId, metadatas[index], datahash);
            })
        );

        return true;
    }

    async FractionsBatchBurn(ctx, tokenIds) {
        for (let i = 0; i < tokenIds.length; i++) {
            await this.Burn(ctx, tokenIds[i]);
        }

        return true;
    }

    async UpdateNFTOwner(ctx, newOwner) {
        if (ctx.clientIdentity.getID() !== this.ContractDeployer) {
            throw new Error('Only contract deployer can call this function');
        }

        this.NFTOwner = newOwner;
    }

    // async GetTokenOwners() {
    //     return this.tokenOwners;
    // }

    async MintWithTokenURIS(ctx, tokenId, metadata, dataHash){
        return this.MintWithTokenURI(ctx, tokenId, metadata, dataHash);
    }

    async MintAndTransferSmallerTokens(ctx, originalTokenId, numberOfSmallerTokens, expirationDate, fractionJson) {
        const caller = ctx.clientIdentity.getID();

        // Retrieve the most recent ownership history record for the originalTokenId
        const historyKey = ctx.stub.createCompositeKey(historyPrefix, [originalTokenId]);
        const historyEntryBuffer = await ctx.stub.getState(historyKey);
        if (!historyEntryBuffer || historyEntryBuffer.length === 0) {
            throw new Error(`No ownership history found for Token ID: ${originalTokenId}`);
        }

        const historyEntry = JSON.parse(historyEntryBuffer.toString());
        const previousOwner = historyEntry.previousOwner;
        const currentOwner = historyEntry.currentOwner;

        // Check if the caller was the previous owner
        if (previousOwner !== caller) {
            throw new Error('Caller is not the (previous) owner of the original ERC721 token');
        }

        // Check if the current owner is the Vault
        if (currentOwner !== vault) {
            throw new Error('The current owner of the token is not the Vault');
        }


        // Define JSON data for the smaller tokens
        const jsonData = {
            name: 'Smaller Token',
            description: 'This is a smaller ERC721 token',
            originalTokenId: originalTokenId,
            fractions: Number(numberOfSmallerTokens),
            timestamp: Math.floor(Date.now() / 1000), // Current timestamp in seconds,
            json: fractionJson,
        };

        // Hash the JSON data
        const jsonHash = crypto.createHash('sha256').update(JSON.stringify(jsonData)).digest('hex');

        const {tokenIds,jsonDatas}=[...Array(Number(numberOfSmallerTokens))].reduce((acc,cur,index)=>{
            const smallerTokenId = `${originalTokenId}-${index + 1}`;

            return {
                tokenIds: [...acc.tokenIds, smallerTokenId],
                jsonDatas: [...acc.jsonDatas, jsonData],
            };
        },{tokenIds: [], jsonDatas: []});

        return await this.FractionsMintWithTokenURI(ctx,tokenIds,jsonDatas,jsonHash);
    }

    // async getFractionBalance
    async getClientAccountBalance(ctx) {
        // const nft = await this._readNFT(ctx, '101', 'nft');
        return await this.ClientAccountBalance(ctx,'balance');
    }

    async getClientFractionAccountBalance(ctx) {
        // const nft = await this._readNFT(ctx, '101-1', 'fraction');
        return await this.ClientAccountBalance(ctx,'fractionBalance');
    }


}

module.exports = {FractionTokenContract};
