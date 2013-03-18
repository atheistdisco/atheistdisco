#!/usr/bin/env node

var path = require("path");
var colors = require("colors");
var request = require("request");
var argv = require("optimist")
	.boolean(['d'])
	.alias('d','dry')
	.argv;

/* get configuration */
var config = require(path.resolve(__dirname, 'config.js'));
var satoshi_factor = 100000000;
var transaction_fee = 50000;
var stack = {}

/* bitcoin to satoshi */
var btc_sat = function(btc) {
	return Math.round(parseFloat(btc)*satoshi_factor);
}

/* satoshi to bitcoin */
var sat_btc = function(sat) {
	return (sat / satoshi_factor);
}

/* get wallet balance */
var wallet_balance = function(callback){
	request({
		"method": "GET",
		"json": true,
		"url": "https://blockchain.info/de/merchant/"+config.wallet.guid+"/address_balance",
		"qs": {
			"password": config.wallet.password,
			"address": config.wallet.address,
			"confirmations": 0
		}
	},function(error, response, data){
		if (!error && response.statusCode == 200 && !('error' in data)) {
			callback(null, data.balance);
		} else {
			callback(true);
		}
	});
}

/* send bitcoins and recieve tx id */
var wallet_send = function(amount, to, callback) {
	console.error(' WLLT SEND '.inverse.bold.magenta, sat_btc(amount).toString().cyan, '➔'.yellow, to.blue);
	request({
		"method": "GET",
		"json": true,
		"url": "https://blockchain.info/de/merchant/"+config.wallet.guid+"/payment",
		"qs": {
			"password": config.wallet.password,
			"to": to,
			"amount": amount,
			"from": config.wallet.address,
			"shared": false,
			"fee": transaction_fee
		}
	},function(error, response, data){
		if (!error && response.statusCode == 200 && !('error' in data)) {
			console.error(' SEND OK   '.inverse.bold.green, "message:".yellow, data.message.blue);
			callback(null, data.tx_hash);
		} else {
			console.error(' SEND FAIL '.inverse.bold.red, data);
		}
	});
}

/* check satoshi dice for a bet with long polling */
var satoshidice_query = function(tx, callback) {
	console.error(' SQRY RQST '.inverse.bold.magenta, tx.cyan);
	request({
		"method": "GET",
		"json": true,
		"url": "http://src.satoshidice.com/longpoll.php",
		"qs": {
			"tx": tx
		}
	},function(error, response, data){
		if (!error && response.statusCode == 200 && (typeof data === 'object')) {
			console.error(' SQRY OK   '.inverse.bold.green);
			if (data.bets.length === 0) {
				console.error(' SQRY RTRY '.inverse.bold.yellow, 'no bets found'.yellow);
				setTimeout(function(){
					satoshidice_query(tx, callback);
				},10000);
			} else {
				var bet = data.bets.shift();
				switch (bet.result) {
					case "WIN":
						/* yay! */
						callback(true, btc_sat(bet.payment_amt), bet.tx_payment);
					break;
					case "LOSE":
						/* oh noes. */
						callback(false, btc_sat(bet.payment_amt), bet.tx_payment);
					break;
					default:
						console.error(' SQRY RTRY '.inverse.bold.yellow, 'neither win nor lose'.yellow);
						setTimeout(function(){
							satoshidice_query(tx, callback);
						},10000);
					break;
				}
			}
		} else {
			console.error(' SQRY FAIL '.inverse.bold.red, data);
			console.error(' SQRY RTRY '.inverse.bold.yellow);
			setTimeout(function(){
				satoshidice_query(tx, callback);
			},10000);
		}
	});
}

/* perform a bet */
var perform_bet = function(amount, callback) {
	if (argv.d) {
		/* just a dry run, phew! */
		var win = (Math.random() < config.satoshidice.odds) ? true : false;
		if (win) {
			amount *= config.satoshidice.factor;
		} else {
			amount = Math.round(Math.random()*1000); // dummy bullshit amount satoshidice is paying back
		}
		callback(win, amount, 'deadfefebeefc0ffeeacabfeedd1ce');
	} else {
		/* omg, using real bitcoins now */
		wallet_send(amount, config.satoshidice.address, function(err, tx){
			if (!err) {
				satoshidice_query(tx, callback);
			}
		});
	}
}

/* double the entry until a win happens */
var perform_streak = function(callback) {
	stack.bet_amount = config.bet.amount;
	var _perform = function() {
		if (stack.bet_amount > stack.balance) {
			/* we don't have funding left */
			callback(false);
		} else {
			perform_bet(stack.bet_amount, function(win, amount, tx){
				stack.balance += (amount - (stack.bet_amount + transaction_fee));
				stack.winnings += (amount - (stack.bet_amount + transaction_fee));
				if (win) {
					/* this streak ended lucky */
					console.error(' BET       '.inverse.bold.green, 'won at'.green, sat_btc(stack.bet_amount).toString().cyan, 'BTC,'.green, sat_btc(stack.balance).toString().cyan, 'BTC left for gambling'.green);
					callback(true);
				} else {
					/* try again with doubled stake */
					console.error(' BET       '.inverse.bold.yellow, 'lost at'.yellow, sat_btc(stack.bet_amount).toString().cyan, 'BTC,'.yellow, sat_btc(stack.balance).toString().cyan, 'BTC left for gambling'.yellow);
					stack.bet_amount *= 2;
					_perform();
				}
			});
		}
	}
	_perform();
}

/* play until the wanted amount is won */
var perfom_run = function(callback) {

	/* check the wallets balance first. could be awkward to run out of money in a streak */
	wallet_balance(function(err, amount){
		if (err) {
			console.error(' PRFRM RUN '.inverse.bold.red, 'unable to query wallet'.red);
			process.exit(1);
		}
		if (amount < config.bet.limit) {
			console.error(' PRFRM RUN '.inverse.bold.red, 'wallet has insufficient funds'.red, sat_btc(amount).toString().cyan, '<'.red, sat_btc(config.bet.limit).toString().cyan);
			process.exit(1);
		}
		console.error(' PRFRM RUN '.inverse.bold.green, 'wallet has sufficient funds'.green, sat_btc(amount).toString().cyan, '>='.green, sat_btc(config.bet.limit).toString().cyan);

		stack.balance = config.bet.limit;
		stack.winnings = 0;
		
		var _perform = function() {
			if (stack.winnings >= config.bet.win) {
				/* holy cow! we made it! */
				callback(true);
			} else {
				perform_streak(function(lucky){
					if (lucky) {
						/* we were lucky. another round! */
						console.error(' STREAK    '.inverse.bold.green, 'successful'.green, sat_btc(stack.winnings).toString().cyan, 'BTC won so far'.green);
						_perform();
					} else {
						/* oh noez, we lost everything :( */
						console.error(' STREAK    '.inverse.bold.red, 'failed'.red, sat_btc(stack.balance).toString().cyan, 'BTC left'.red);
						callback(false);
					}
				});
			}
		}
		_perform();
	});	
}

perfom_run(function(lucky){
	if (lucky) {
		console.log('you have just won'.green, sat_btc(stack.winnings).toString().magenta, 'BTC'.green);
		console.log('\ndon\'t forget to send a tip to'.white, '1EpgHtSVhAAm8ouzALxaimrcPwheq9Hxfa'.magenta, '\n');
	} else {
		console.log('you lost everything. sorry.'.red);
	}
});