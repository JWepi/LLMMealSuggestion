
import json
import asyncio
import websockets
import sys

f = open('config.json', "r")
data = json.loads(f.read())

wsport = data['WebsocketPort']
listeninglocation = data['ListeningLocation']
echo = True
echoErr = True
clients = []

def myprint(msg, err = False):
    if (echo and not err):
        print('---------- ' + str(msg))
    if (echoErr and err):
        print('########## ' + str(msg))

#-------------------------------------

class Receiver:
    websocket = None
    failInfos = None

    def __init__ (self, ws):
        myprint('Receiver init')
        self.websocket = ws
        self.handleConnected(ws)
        
    def handleConnected(self, websocket):
        myprint(str(self.websocket.remote_address) + ' connected')
        clients.append(self.websocket)

    def handleClose(self, websocket):
        myprint(str(self.websocket.remote_address) + ' closed')
        clients.remove(self.websocket)
            
    async def handleMessage(self, websocket, data):
        jsonData = None
        if data != None:
            myprint('\nhandleMessage ' + str(data))
        try:
            jsonData = json.loads(str(data))
            if jsonData == None or 'action' not in jsonData or jsonData["action"] == None or jsonData["data"] == None:
                myprint('Received message does not contain expected values "action" and "data"', True)
                return await self.mySendMessage(self.buildAnswer(False,"The data you sent wasn't correct or well formated, 'action' and 'data' expected",{}))

            if echo and jsonData != None and 'action' in jsonData and jsonData["action"] == "echo":
                myprint('echoing: ' + str(jsonData))
                return await self.mySendMessage(self.buildAnswer(True,"Echoing",jsonData))

            return await self.mySendMessage(await self.parseMessage(jsonData))
        except Exception as e:
            myprint('Error in handleMessage: ' + str(sys.exc_info()), True)
    
        return await self.mySendMessage(self.buildAnswer(False,"There has been a problem, maybe with the data you sent",{}))

    async def mySendMessage(self, jsonToSend):
        if jsonToSend == None:
            myprint('Nothing to send to the client !', True)
            jsonToSend = self.buildAnswer(True,"Success",{})
        if jsonToSend == False:
            msgToSend = 'Something was wrong' + (':' + self.failInfos if self.failInfos != None else '!')
            myprint(msgToSend, True)
            jsonToSend = self.buildAnswer(False,msgToSend,{})
        if 'result' not in jsonToSend or 'message' not in jsonToSend or 'data' not in jsonToSend:
            jsonToSend = self.buildAnswer(True,"Success",jsonToSend)
        myprint('Sending message to client: ' + str(jsonToSend))
        self.failInfos = None
        await self.websocket.send(jsonToSend)
    
    async def parseMessage(self, jsonData):
        myprint('parseMessage of ' + str(jsonData))
        return await self.actions(jsonData["action"], jsonData["data"])

    async def checkData(self, data, properties):
        myprint("checkData " + properties[0])
        for item in properties:
            myprint('Check if ' + item + ' in ' + str(data))
            if item not in data or data[item] == None:
                myprint(item + ' is not found in the transmited data !', True)
                imploded = ','.join([str(i) for i in properties])
                await self.mySendMessage(self.buildAnswer(False,"The data you sent wasn't correct, expected properties: " + imploded,{}))
                return False
        return True
        
    def buildAnswer(self, success, message, data):
        if data == None:
            data = {}
        return json.dumps({'result': 'success' if success else 'error','message':message,'data':data});

    async def actions(self, action, data):
        switcher = {
        'saveDishes':self.saveDishes,
        'saveRecipe':self.saveRecipe,
        'getDishes':self.getDishes,
        'getRecipe':self.getRecipe
        }
        if (action in switcher):
            return await switcher.get(action, lambda: 'invalid action')(data)
        return(self.buildAnswer(False,"Action '" + action + "' doesn't exist !",{}))
        
    async def saveDishes(self, data):
        props = ["cuisine", "foods", "dishes"]
        if (not await self.checkData(data,props)):
            return False
        toret = {}
        
        return '{"action":"saveDishes", "data":'+str(toret)+'}'

    async def saveRecipe(self, data):
        props = ["cuisine", "dish", "recipe"]
        if (not await self.checkData(data,props)):
            return False
        toret = {}
        
        return '{"action":"saveRecipe", "data":'+str(toret)+'}'

    async def getDishes(self, data):
        props = ["cuisine", "foods"]
        if (not await self.checkData(data,props)):
            return False
        toret = {}
        
        return '{"action":"getDishes", "data":'+str(toret)+'}'

    async def getRecipe(self, data):
        props = ["cuisine", "dish"]
        if (not await self.checkData(data,props)):
            return False
        toret = {}
        
        return '{"action":"getRecipe", "data":'+str(toret)+'}'

async def connection(websocket, path):
    rcv = Receiver(websocket)
    try:
        async for message in websocket:
            await rcv.handleMessage(websocket, message)
    finally:
        rcv.handleClose(websocket)

myprint('Starting websocket listening on port ' + str(wsport))

start_server = websockets.serve(connection, listeninglocation, wsport)
asyncio.get_event_loop().run_until_complete(start_server)
asyncio.get_event_loop().run_forever()

myprint('You should not be able to read this, is there an issue with websockets?')