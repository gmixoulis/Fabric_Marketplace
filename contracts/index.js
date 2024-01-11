/*
SPDX-License-Identifier: Apache-2.0
*/

'use strict';

const tokenERC721Contract = require('./lib/tokenERC721.js');
const {TokenERC20Contract} = require('./lib/tokenERC20.js');
const FractionToken = require('./lib/FractionToken.js');

module.exports.tokenERC721Contract = tokenERC721Contract;
module.exports.TokenERC20Contract = TokenERC20Contract;
module.exports.FractionToken = FractionToken;
module.exports.contracts = [tokenERC721Contract,TokenERC20Contract,FractionToken];
