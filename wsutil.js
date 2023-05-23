define([], function () {
    'use strict';
	
	var toret = {
		connection: null,
		disabled: true,
		echo: true,
		
		initialize: function(options){
			var that = this;
			window.WebSocket = window.WebSocket || window.MozWebSocket;
			if (!window.WebSocket) {
				this.myLog("Browser don't support websockets !!!", true);
				return;
			}
			
			if (!options || !options.address || !options.port)
			{
				this.myLog("Must give 'address' and 'port' in initialize", true);
				return;
			}

			return new Promise(function(resolve, reject) {
				that.connection = new WebSocket('ws://'+options.address+':'+options.port);
				
				that.connection.onopen = function () {
					that.disabled = false;
					resolve(that.connection);
				};

				that.connection.onerror = function (error) {
					that.myLog("There's a problem with your connection or the server: " + error.toString(), true);
					reject(error);
				};

				that.connection.onmessage = function (message) {
					try {
						message = JSON.parse(message.data);
					} catch (e) {
						that.myLog('Received message is not a valid JSON');
					}
					if (message.result == 'error'){
						console.error("-----DinnerBack-----", message.message, message.data);
					}
					that.myManageMessage(message);
				};
			});
		},
		
		myLog: function(msg, critical){
			if (this.echo || critical)
				console.log('-----DinnerBack----- ' + msg);
		},
		
		// Unstringified objects should arrive here as tosend
		mySend: function(tosend){
			if (this.disabled || !this.connection){
				this.myLog("Service disabled or no connection established yet", true);
				return false;
			}
			try {
				this.connection.send(JSON.stringify(tosend));
			}
			catch (exc){
				this.myLog("The data to send couldn't be JSON stringified, there may be a circular reference inside of it ...", true);
			}
		},
		
		myManageMessage: function(message){
			this.myLog("myManageMessage " + message.toString());
		},
		
		buildActionObject: function(action, data){
			return({"type":"action","action":action,"data":data});
		},
		
		saveDishes: function(cuisine, foods, dishes){
			this.mySend(this.buildActionObject("saveDishes",{"cuisine":cuisine,"foods":foods,"dishes":dishes}));
		},
		
		saveRecipe: function(cuisine, dish, recipe){
			this.mySend(this.buildActionObject("saveRecipe",{"cuisine":cuisine,"dish":dish,"recipe":recipe}));
		},
		
		getDishes: function(cuisine, foods){
			this.mySend(this.buildActionObject("getDishes",{"cuisine":cuisine,"foods":foods}));
		},

		getRecipe: function(cuisine, dish){
			this.mySend(this.buildActionObject("getRecipe",{"cuisine":cuisine,"dish":dish}));
		}
	};
	
	return toret;
});