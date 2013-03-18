module.exports = {
	/* this is for a wallet at blockchain.info. */
	"wallet": {
		"guid": "",
		"address": "",
		"password": ""
	},
	/* the satoshidice address. factor and odds are just for dry-run-mode */
	"satoshidice": {
		"address": "1dice8EMZmqKvrGE4Qc9bUFf9PX3xaYDp", // changing this makes no sense.
		"factor": 2.003848,
		"odds": 0.488281
	},
	/* your betting strategy. these defaults are reasonable. */
	"bet": {
		"amount": 1000000, // the amount you want to set. minimum is 1000000 satoshi (0.01 BTC)
		"limit": 32000000, // the maximum you want to loose. 
		"win": 500000      // stop gambling after winning this amount (0.005 BTC)
	}
}