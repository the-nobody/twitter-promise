# Twitter Promise

Twitter promise is a Class utility for accessing the Twitter API.

## installing
```console
npm install twitter-promise --save  
```

## including in your code
```javascript
const Twitter = require("twitter-promise")
```

Dependencies:
1. request

Example:

## TwitterServer.js
or create your own name
```javascript
const Twitter = require("twitter-promise");

Class TwitterServer extends Twitter {
  constructor(auth) {
    super(auth);
  }
  
  timeline(screen_name) {
    return new Promise((resolve, reject) => {
      // because we extend Twitter into TwitterServer all it's methods/properties are inherited into the 'this' scope.
    	this.get({
          path: "statuses/user_timeline",
          params: { screen_name }
        })
        .then(response => {
          resolve(response);
        })
        .catch(err => {
          reject(err);
        });
    });
  }  
}

module.exports = TwitterServer

```

## Using
TwitterServer.js in some other file
```javascript
// using TwitterServer
const TwitterServer = require("TwitterServer.js");
const tw = new TwitterServer({
  consumer_key: "your_key",
  consumer_secret: "your_secret",
  token: "your_token",
  token_secret: "your_secret"
});

// now let's get our timeline from the new twitter server
tw.timeline("screen_name")
  .then(response => {
    console.log("RESPONSE", response);
  })
  .catch(err => {
    console.log("ERROR", err);
  });
```
