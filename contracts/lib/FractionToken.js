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

// const fractionPrefix = 'FRACTION';
// const vault= 'VAULT';
class FractionToken extends TokenERC721Contract {

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

    async GetTokenOwners() {
        return this.tokenOwners;
    }

    async MintWithTokenURIS(ctx, tokenId, metadata, dataHash){
        return this.MintWithTokenURI(ctx, tokenId, metadata, dataHash);
    }

    async MintAndTransferSmallerTokens(ctx, originalTokenId, numberOfSmallerTokens, expirationDate, fractionJson) {
        const caller = ctx.clientIdentity.getID();

        // Check if the caller is the owner of the original ERC721 token
        const originalTokenOwner = await this.OwnerOf(ctx, originalTokenId, 'nft');
        if (originalTokenOwner !== caller) {
            throw new Error('Caller is not the owner of the original ERC721 token');
        }

        // Read details of the original ERC721 token
        const originalToken = await this._readNFT(ctx, originalTokenId);

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
        return await this.ClientAccountBalance(ctx,'balance');
    }

    async getClientFractionAccountBalance(ctx) {
        return await this.ClientAccountBalance(ctx,'fractionBalance');
    }
}

module.exports = FractionToken;
