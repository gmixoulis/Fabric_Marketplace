/*
SPDX-License-Identifier: Apache-2.0
*/

'use strict';

const tokenERC721Contract = require('./lib/tokenERC721.js');
const tokenERC20Contract = require('./lib/tokenERC20.js');
const marketplaceContract = require('./lib/marketplace.js');

module.exports.tokenERC721Contract = tokenERC721Contract;
module.exports.TokenERC20Contract = tokenERC20Contract;
module.exports.marketplaceContract = marketplaceContract;
module.exports.contracts = [
    marketplaceContract,
    tokenERC721Contract,
    tokenERC20Contract,
];
