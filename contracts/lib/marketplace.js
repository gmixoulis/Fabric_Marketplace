/*
 * Copyright SIDROCO HOLDINGS LTD. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
*/

'use strict';

const { Contract } = require('fabric-contract-api');

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

    /**
     * Burn a non-fungible token
     *
     * @param {Context} ctx the transaction context
     * @param {String} tokenId Unique ID of a non-fungible token
     * @returns {Boolean} Return whether the burn was successful or not
     */
    async LockNFT(ctx, tokenId) {
        const owner = ctx.clientIdentity.getID();
        const channel = await ctx.stub.getChannelID();

        await ctx.stub.invokeChaincode('marketplace', ['TransferFrom', owner, vault, tokenId], channel);

        const historyKey = ctx.stub.createCompositeKey(historyPrefix, [tokenId]);
        const historyEntry = {
            previousOwner: owner,
            currentOwner: 'Vault', // Assuming the vault is the new owner
            timestamp: new Date().toISOString(),
        };

        await ctx.stub.putState(historyKey, Buffer.from(JSON.stringify(historyEntry)));

        return true;
    }

}

module.exports = MarketplaceContract;
