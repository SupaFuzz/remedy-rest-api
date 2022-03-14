/*
    remedy-rest-api.js      6/19/18 andrew@hicox.com <Andrew Hicox>
    this is an object-oriented javascript library for talking
    to BMC Remedy ARS REST Webservices.
*/

/*

    DO-TO (6/19/18 @ 1648)

        * support for sending attachments

        * ARFormEntry class to model a set of fields from a form
          also 'Status History', Diary fields, Associations, yadda yadda

        * ARFormEntryList class to model a result set (query output)

        * pushFields emulation

        * legit npm release

*/



/*
    NODE STUFF
    this section contains stuff to set up the node.js XHR emulation API
    just comment this stuff out if you want to use it in a browser.
*/
'use strict';

var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;      // include the XHR emulation API
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";                     // trust shady SSL certs




/*
    noiceObjectCore
    this is a simple object class that defines my favorite constructor model.
    everything inherits from it 'cause I rollz like that.
*/
class noiceObjectCore {

/*
    constructor({args}, {defaults})
        {args}
        is an object reference modelling user-specified arguments to the constructor
        every enumerable attribute will be copied into the resulting object.

        {defaults}
        is an object reference modelling class-default attributes, every enumberable
        attribute eill be copied into the resulting object, however {args} overrides
        attributes found here

        NOTE: attribute names prefixed with the underscore char (_) are created as
        non-enumerable attributes (meaning they are present but Object.keys won't
        see them and JSON.stringify won't either). Generally speaking, these are
        "internal" attributes and you'd create getter and setter methods for them

        NOTE ALSO: as a convention, each class should define _version and _className
        class defaults.

*/
constructor (args, defaults, callback){

    // every noiceObjectCore descendant class should override these on {defaults}
    let classDefaults = {
        _version:       1,
        _className:     'noiceObjectCore'
    };

    // helper function to spawn the attributes
    function createAttribute(self, key, val){
        Object.defineProperty(self, key, {
            value:        val,
            writable:     true,
            enumerable:   (! (/^_/.test(key))),
            configurable: true
        });
    }

    // pull in defaults, then args
    [classDefaults, defaults, args].forEach(function(attributeSet){
        if ((attributeSet === null) || (attributeSet === undefined) || (typeof(attributeSet) != 'object')){ return(false); }
        Object.keys(attributeSet).forEach(function(k){
            createAttribute(this, k, attributeSet[k]);
        }, this);
    }, this);
}

} // end noiceObjectCore class




/*
    noiceCoreUtility
    this adds a few utility functions to noiceObjectCore
*/
class noiceCoreUtility extends noiceObjectCore {


/*
    isNull(value)
    return true if the given value is one of the myriad ways to
    say "this thing doesn't carry a value"
*/
isNull(val){
    return(
       (typeof(val) === 'undefined') ||
       (val === null) ||
       (val === undefined) ||
       (val == "null") ||
       (/^\s*$/.test(val))
    );
}


/*
    isNotNull(value)
    return the inverse of isNull()
*/
isNotNull(val){ return(! this.isNull(val)); }


/*
    hasAttribute(attributeName)
    return true if this has <attributeName> and
    the value of that attribute is not null
*/
hasAttribute(attributeName){
    return(this.hasOwnProperty(attributeName) && this.isNotNull(this[attributeName]));
}


/*
    epochTimestamp(bool)
    return the unix epoch in seconds
    unless bool is true, then return miliseconds
*/
epochTimestamp(bool){
    if (bool === true){
        return(new Date().getTime());
    }else{
        return(Math.round(new Date().getTime() / 1000));
    }
}


/*
    toEpoch(string, bool)
    <string> contains the string to attempt to convert into an epoch integer
    <bool> (default true), if false returns course value (seconds), if true fine (milliseconds)
*/
toEpoch(date, fine){
    if (fine !== false){ fine = true; }
    try {
        return(fine?Date.parse(date):(Date.parse(date)/1000));
    }catch(e){
        throw(`[toEpoch]: failed to parse timestamp: ${e}`);
    }
}


/*
    fromEpoch(integer, type)
    <integer> is the epoch timestamp (course values will be backfilled to fine)
    <type> is an enum: date | time | dateTime
    returns an ARS/REST compatible ISO 8601 date / time / dateTime string
*/
fromEpoch(epoch, type){

    // sort out the epoch format
    if (this.isNull(epoch)){ throw(`[fromEpoch]: given epoch value is not valid`); }
    try {
        epoch = parseInt(epoch.toString(), 10);

        /*
            NOTE LOOSE END (6/21/18 @ 1732)
            this could probably bite ya ...
        */

        if (epoch <= 9999999999){ epoch = (epoch * 1000);}
    }catch(e){
        throw(`[fromEpoch]: failed integer conversion of given epoch time: ${e}`);
    }


    // ya rly
    function pad(number) {
      if (number < 10) {
        return '0' + number;
      }
      return number;
    }

    // convert it
    switch(type){
        case 'date':
            try {
                let myDate = new Date(epoch);
                return(`${myDate.getUTCFullYear()}-${pad(myDate.getUTCMonth() + 1)}-${pad(myDate.getUTCDate())}`)
            }catch(e){
                throw(`[fromEpoch]: failed time conversion: ${e}`);
            }
        break;
        case 'time':
            try {
                let myDate = new Date(epoch);
                return(`${pad(myDate.getUTCHours())}:${pad(myDate.getUTCMinutes())}:${pad(myDate.getUTCSeconds())}`)
            }catch(e){
                throw(`[fromEpoch]: failed time conversion: ${e}`);
            }
        break;
        case 'dateTime':
            try {
                return(new Date(epoch).toISOString());
            }catch(e){
                throw(`[fromEpoch]: failed dateTime conversion: ${e}`);
            }
        break;
        default:
            throw('[fromEpoch]: invalid date type specified');
    }
}

/*
    NOTE: we might want to have some currency manipulation helpers here
*/


} // end noiceCoreUtility class




/*
    ARSRestException
    this is an object model representing an exception received
    from the ARS REST Service.

    objects of the ARSRestException class have the form:
    {
        httpStatus:             <http status code>
        httpResponseHeaders:    {
            <headerName>:       <headerValue>
        }
        thrownByFunction:       (optional) name of ARSRestAPI function that threw it
        thrownByFunctionArgs:   (optional) a copy of the args sent to <thrownByFunction> (if speficied)
        arsErrorList:           [
            {
                messageType:            ok | error | warning | fatal | bad status | non-ars,
                messageText:            main error message ($ERRMSG$)
                messageAppendedText:    addtional error message ($ERRAPPENDMSG$)
                messageNumber:          error number (integer / $ERRNO$)
            },
            ...
        ]
    }

    since the AR Server may return an arbirtrary number of error objects
    in a REST exception, these attribute accessors return data from the
    FIRST error in the list:

        *.message (returns *.messageText of first entry in arsErrorList unless separately)
        *.messageType (returns *.messageType of first entry in arsErrorList unless empty then 'non-ars')
        *.messageText
        *.messageAppendedText
        *.messageNumber
*/
class ARSRestException extends noiceCoreUtility {


/*
    constructor({
        xhr:                    (optional) if specfied, extract arsErrorList, httpStatus and httpResponseHeaders
        message:                (optional) if specified, return this on *.message rather than the first entry in arsErrorList
        messageType:            (optional) if specified, return this on *.messageType rather than the first entry in arsErrorList
        thrownByFunction:       (optional) name of function that threw the error
        thrownByFunctionArgs:   (optional) copy of args sent to function that threw the error
    })
*/
constructor(args){

    // set it up
    super(args, {
        _version:            1,
        _className:          'ARSRestException',
        _lastResort:         [],
        _message:            '',
        _messageType:        '',
        httpResponseHeaders: {},
        arsErrorList:        []
    });

    this.time = this.epochTimestamp(true);

    // if we've got an xhr, parse it out
    if (this.hasAttribute('xhr')){

        // try to get the httpStatus
        try {
            this.httpStatus = this.xhr.status;
        }catch (e){
            this.httpStatus = 0;
            this._lastResort.push(`[httpStatus]: cannot find ${e}`);
        }

        // try to get the httpResponseHeaders
        try {
            this.xhr.getAllResponseHeaders().trim().split(/[\r\n]+/).forEach(function(line){
                line = line.replace(/[\r\n]+/, '');
                let tmp = line.split(/:\s+/,2);
                this.httpResponseHeaders[tmp[0]] = tmp[1];
            }, this);
        }catch (e){
            this._lastResort.push(`[httpResponseHeaders]: failed to parse ${e}`);
        }

        // try to parse out ars errors
        if (this.isNotNull(this.xhr.responseText)){
            try {
                this.arsErrorList = JSON.parse(this.xhr.responseText)
            }catch (e){
                this._lastResort.push(`[arsErrorList]: failed to parse ${e}`);
                this.messageType = 'non-ars';
            }
        }else{
            this.messageType = 'non-ars';
            this._message += '(error object not returned from ARServer)';
        }
    } // end handling xhr
}


/*
    getter and setter for 'message'
    return this.message if it's set otherwise the first
    messageText from arsErrorList, or an error stating why not
*/
set message(v){ this._message = v; }
get message(){
    if (this.hasAttribute('_message')){
        return(this._message);
    }else {
        try {
            return(this.arsErrorList[0].messageText);
        }catch (e){
            return('no error messsage available (not set, cannot be parsed from xhr)');
        }
    }
}


/*
    getter and setter for 'messageType'
    return this.message if it's set otherwise the first
    messageText from arsErrorList, or an error stating why not
*/
set messageType(v){ this._messageType = v; }
get messageType(){
    if (this.hasAttribute('_messageType')){
        return(this._messageType);
    }else {
        try {
            return(this.arsErrorList[0].messageType);
        }catch (e){
            return('no messageType available (not set, cannot be parsed from xhr)');
        }
    }
}


/*
    getters for arsErrorList properties
    all default to the first entry in arsErrorList or false
*/
get messageText(){
    try {
        return(this.arsErrorList[0].messageText);
    }catch (e){
        return(false);
    }
}

get messageAppendedText(){
    try {
        return(this.arsErrorList[0].messageAppendedText);
    }catch (e){
        return(false);
    }
}

get messageNumber(){
    try {
        return(this.arsErrorList[0].messageNumber);
    }catch (e){
        return(false);
    }
}

/*
    return a legit Error object
*/
get error(){
    return(new Error(this.message));
}

/*
    return a nice string
*/
toString(){
    return(`[http/${this.httpStatus} ${this.messageType} (${this.messageNumber})]: ${this.message} / ${this.messageAppendedText}`);
}


} // end ARSRestException class




/*
    ARSRestDispatcher
    this extends noiceCoreUtility to provide utility functions for dispatching
    REST calls via the XHR api. This class should provide an abstract interface
    for accessing XHR from either node or in a browser.
*/
class ARSRestDispatcher extends noiceCoreUtility {


/*
    constructor({
        endpoint:           <url>
        method:             GET | POST | PUT | DELETE ,
        headers:            { header:value ...},
        content:            { object will be JSON.strigified before transmit }
        expectHtmlStatus:   <integer> (receiving this = reolve, else reject promise)
    })
*/
constructor (args){

    // set it up
    super(args, {
        _version:       1,
        _className:     'ARSRestDispatcher',
        timeout:        0,
        debug:          false,
        encodeContent:  true
    });

    // required arguments
    ['endpoint', 'method', 'expectHtmlStatus'].forEach(function(k){
        if (! this.hasAttribute(k)){
            throw(`[ARSRestDispatcher (constructor)]: ${k} is a required argument`);
        }
    }, this);

    // handle multiple expectHtmlStatus values
    this.myOKStatuses = [];
    if ((typeof(this.expectHtmlStatus) == 'number') || (typeof(this.expectHtmlStatus) == 'string')) {
        this.myOKStatuses.push(this.expectHtmlStatus);
    }else{
        this.myOKStatuses = this.expectHtmlStatus;
    }

    // REMOVE ME
    if (this.debug){ console.log(`[ARSRestDispatcher (endpoint)]: ${this.endpoint}`); }

}


/*
    go()
    this creates the xhr in question, sends it and returns a rejected or resolved promise
    rejected promises are mangled into ARSRestException objects. resolved promises just
    return the xhr and your caller can do what they need to do
*/
go(){
    let self = this;
    return(new Promise(function(resolve, reject){
        let xhr = new XMLHttpRequest();
        if (self.timeout > 0){ xhr.timeout = self.timeout; }
        if (self.hasAttribute('responseType')){ xhr.responseType = self.responseType; }

        // success callback
        xhr.addEventListener("load", function(){
            if (self.myOKStatuses.indexOf(this.status) >= 0){
                self.end = self.epochTimestamp(true);
                resolve(this);
            }else{
                self.end = self.epochTimestamp(true);
                reject(new ARSRestException({'xhr': this, 'event': 'load'}));
            }
        });

        // error callback
        xhr.addEventListener("error", function(){
            self.end = self.epochTimestamp(true);
            reject(new ARSRestException({
                'xhr':   this,
                'event': 'error',
                message: 'ARSRestDispatcher recieved "error" event (probably a timeout)'
            }));
        });

        // abort callback
        xhr.addEventListener("abort", function(){
            self.end = self.epochTimestamp(true);
            reject(new ARSRestException({
                'xhr':   this,
                'event': 'abort',
                message: 'ARSRestDispatcher recieved "abort" event (probably user cancel or network issue)'
            }));
        });

        // open it up
        xhr.open(self.method, self.endpoint);

        // set request headers
        let keepTruckin = true;
        if ((self.hasOwnProperty('headers')) && (typeof(self.headers) === 'object')){
            try {
                Object.keys(self.headers).forEach(function(k){
                    xhr.setRequestHeader(k, self.headers[k]);
                });
            }catch(e){
                keepTruckin = false;
                reject(new ARSRestException({
                    messageType:    'non-ars',
                    message:        `failed to set request headers: ${e}`
                }));
            }
        }

        // encode the content if we have it
        if (self.hasAttribute('content') && keepTruckin){
            let encoded = '';
            if (self.encodeContent){
                try {
                    encoded = JSON.stringify(self.content);
                }catch(e){
                    keepTruckin = false;
                    reject(new ARSRestException({
                        messageType:    'non-ars',
                        message:        `failed to encode content with JSON.stringify: ${e}`
                    }));
                }
            }else{
                encoded = self.content;
            }
            if (keepTruckin){
                if (self.debug){ self.start = self.epochTimestamp(true); }
                xhr.send(encoded);
            }

        }else if (keepTruckin){
            if (self.debug){ self.start = self.epochTimestamp(true); }
            xhr.send();
        }
    }));
}


} // end ARSRestDispatcher class




/*
    RemedyRestAPI class
    this is the main user-facing class.
*/
class RemedyRestAPI extends noiceCoreUtility {


/*
    constructor({
        protocol:   http | https (default https)
        server:     <hostname>
        port:       <portNumber> (optionally specify a nonstandard port number)
        user:       <userId>
        password:   <password>
    })

    everything is optional, but if you wanna call *.authenticate, you've got
    to set at least server, user & pass either here, before you call *.authenticate
    or on the args to *.authenticate
*/
constructor (args){
    super(args, {
        _version:       1,
        _className:     'RemedyRestAPI',
        debug:          false,
        protocol:       'https',
        timeout:        (60 * 1000 * 2),        // <-- default 2 minute timeout
    });

    // sort out the protocol and default ports
    switch (this.protocol){
        case 'https':
            if (! this.hasAttribute('port')){ this.port = 443; }
        break;
        case 'http':
            if (! this.hasAttribute('port')){ this.port = 80; }
        break;
        default:
            throw(new ARSRestException({
                messageType:    'non-ars',
                message:        `unsupported protocol: ${this.protocol}`
            }));
    }

}




/*
    authenticate({args})
    all args optional if already set on the object
        protocol:   http | https (default https)
        server:     <hostname>
        port:       <portNumber> (optionally specify a nonstandard port number)
        user:       <userId>
        password:   <password>

    this function returns a reference to self so one can chain it inline with the constructor:

        let api = await new Remedy(testServer).authenticate().catch(function(e){
            // authenticate failed, deal with it here
        });
*/
authenticate(p){
    let self = this;
    return(new Promise(function(resolve, reject){

        // check args
        let inputValid = true;

        ['protocol', 'server','user','password'].forEach(function(a){
            if ((typeof(p) !== 'undefined') && p.hasOwnProperty(a) && self.isNotNull(p[a])){ self[a] = p[a]; }
            if (inputValid && (! self.hasAttribute(a))){
                inputValid = false;
                reject(new ARSRestException({
                    messageType:            'non-ars',
                    message:                `required argument missing: ${a}`,
                    thrownByFunction:       'authenticate',
                    thrownByFunctionArgs:   (typeof(p) !== 'undefined')?p:{}
                }));
            }
        });

        if (inputValid){
            new ARSRestDispatcher({
                endpoint: `${self.protocol}://${self.server}:${self.port}${(self.hasAttribute('proxyPath'))?self.proxyPath:''}/api/jwt/login`,
                method:   'POST',
                headers:  {
                    "Content-Type":     "application/x-www-form-urlencoded",
                    "Cache-Control":    "no-cache"
                },
                expectHtmlStatus: 200,
                timeout:       self.timeout,
                content:       `username=${self.user}&password=${self.password}`,
                encodeContent: false
            }).go().then(function(xhr){
                // handle success
                self.token = xhr.responseText;
                resolve(self);
            }).catch(function(e){
                // handle error
                e.thrownByFunction     = 'authenticate';
                e.thrownByFunctionArgs =   (typeof(p) !== 'undefined')?p:{}
                reject(e);
            });
        }
    }));
}




/*
    isAuthenticated
    return true if we have an api session token, else false
*/
get isAuthenticated(){
    return(this.hasAttribute('token'));
}




/*
    logout()
    destroy the session token on the server
*/
logout(){
    let self = this;
    return(new Promise(function(resolve, reject){

        // input validation
        let inputValid = true;

        // if we're not authenticated, don't bother
        if (! self.isAuthenticated){
            inputValid = false;
            if (self.debug){ console.log('[logout] call on object that is not authenticated. nothing to do.'); }
            resolve(true);
        }

        // check args
        if (inputValid){
            ['protocol', 'server'].forEach(function(a){
                if (inputValid && (! self.hasAttribute(a))){
                    inputValid = false;
                    reject(new ARSRestException({
                        messageType:            'non-ars',
                        message:                `required argument missing: ${a}`,
                        thrownByFunction:       'logout'
                    }));
                }
            });
        }

        // do the dirtay deed dirt cheap ...
        if (inputValid){
            new ARSRestDispatcher({
                endpoint: `${self.protocol}://${self.server}:${self.port}${(self.hasAttribute('proxyPath'))?self.proxyPath:''}/api/jwt/logout`,
                method:   'POST',
                headers:  {
                    "Authorization":    `AR-JWT ${self.token}`,
                    "Cache-Control":    "no-cache",
                    "Content-Type":     "application/x-www-form-urlencoded"
                },
                expectHtmlStatus: 204,
                timeout:    self.timeout
            }).go().then(function(xhr){
                // handle success
                delete(self.token);
                resolve(true);
            }).catch(function(e){
                // handle error
                e.thrownByFunction = 'logout';
                reject(e);
            });
        }
    }));
}




/*
    query({
        schema:       <form name>
        fields:       [array, of, fieldnames, to, get, values, for] -- note add something for assoc stuff later
        QBE:          <QBE string>
        offset:       <return data from this row number -- for paging>
        limit:        <max number of rows to return>
        sort:         <see the docs. but basically <field>.asc or <field>.desc comma separated

    })
*/
query(p){
    let self = this;
    return(new Promise(function(resolve, reject){

        // input validation
        let inputValid = true;

        // if we're not authenticated, don't bother
        if (! self.isAuthenticated){
            inputValid = false;
            reject(new ARSRestException({
                messageType:            'non-ars',
                message:                `operation requires authentication and api handle is not authenticated`,
                thrownByFunction:       'query'
            }));
        }

        // arguments are required
        if (inputValid && (typeof(p) !== 'object')){
            inputValid = false;
            reject(new ARSRestException({
                messageType:            'non-ars',
                message:                `required inputs missing: given argument is not an object ${typeof(p)}`,
                thrownByFunction:       'query'
            }));
        }

        // check args
        ['schema', 'fields', 'QBE'].forEach(function(a){
            if (inputValid && ((! p.hasOwnProperty(a)) || self.isNull(p[a]))){
                inputValid = false;
                reject(new ARSRestException({
                    messageType:            'non-ars',
                    message:                `required argument missing: ${a}`,
                    thrownByFunction:       'query',
                    thrownByFunctionArgs:   p
                }));
            }
        });

        // fields has to be an object too
        if (inputValid && (typeof(p.fields) !== 'object')){
            inputValid = false;
            reject(new ARSRestException({
                messageType:            'non-ars',
                message:                `required argument missing: 'fields' is not an object (${typeof(p.fields)})`,
                thrownByFunction:       'query',
                thrownByFunctionArgs:   p
            }));
        }
        // default value for fetchAttachments
        if ((! p.hasOwnProperty('fetchAttachments')) || (p.fetchAttachments !== true)){ p.fetchAttachments = false; }

        if (inputValid){
            /*
                11/1/2018 -- apparently the field list has to be url encoded as well
            */
            let getList = [];
            p.fields.forEach(function(field){
                getList.push(encodeURIComponent(field));
            });

            // get the endpoint together
            let url = `${self.protocol}://${self.server}:${self.port}${(self.hasAttribute('proxyPath'))?self.proxyPath:''}/api/arsys/v1/entry/${encodeURIComponent(p.schema)}/?q=${encodeURIComponent(p.QBE)}&fields=values(${getList.join(",")})`;
            ['offset', 'limit', 'sort'].forEach(function(a){
                if ((p.hasOwnProperty(a)) && (self.isNotNull(p[a]))){
                    url += `&${a}=${encodeURIComponent(p[a])}`;
                }
            });

            new ARSRestDispatcher({
                endpoint: url,
                method:   'GET',
                headers:  {
                    "Authorization":    `AR-JWT ${self.token}`,
                    "Content-Type":     "application/x-www-form-urlencoded",
                    "Cache-Control":    "no-cache"
                },
                expectHtmlStatus: 200,
                timeout:    self.timeout
            }).go().then(function(xhr){
                // handle success

                /*
                    LOOSE END 6/19/18 @ 1505
                    we should be blessing the result into an ARResultList object
                    but of course first we need to write that class
                */

                try {
                    let resp = JSON.parse(xhr.responseText);
                    let promiseKeeper = [];

                    // handle getting attachments (if enabled)
                    if (p.fetchAttachments){
                        resp.entries.forEach(function(row){

                            // figure out the entry id we're dealin' with for the getAttachment call
                            if (row.hasOwnProperty('_links') && row._links.hasOwnProperty('self') && row._links.self[0].hasOwnProperty('href')){
                                let parse = row._links.self[0].href.split('/');
                                let ticket = parse[(parse.length -1)];

                                // find attachment fields if there are any
                                Object.keys(row.values).forEach(function(field){
                                    if ((typeof(row.values[field]) == 'object') && row.values[field].hasOwnProperty('name') && row.values[field].hasOwnProperty('sizeBytes')){
                                        if (self.debug){ console.log(`fetching attachment from record: ${ticket} and field: ${field} with size: ${row.values[field].sizeBytes} and filename: ${row.values[field].name}`); }
                                        promiseKeeper.push(
                                            self.getAttachment({
                                                schema:     p.schema,
                                                ticket:     ticket,
                                                fieldName:  field
                                            }).then(function(data){
                                                row.values[field].data = data;
                                            })
                                        );
                                    }
                                });
                            }else{
                                if (self.debug){ console.log("[query]: can't parse entryId from self link to get attachment");}
                            }
                        }); // end itterating fields on rows looking for attachments to fetch
                        if (promiseKeeper.length > 0){
                            Promise.all(promiseKeeper).then(function(p){
                                resolve(resp);
                            }).catch(function(e){
                                // e should already be blessed into ARSRestException
                                reject(e);
                            });
                        }
                    }else{
                        resolve(resp);
                    }
                }catch (e){
                    reject(new ARSRestException({
                        messageType:            'non-ars',
                        message:                `failed to parse server response (JSON.parse): ${e}`,
                        thrownByFunction:       'query',
                        thrownByFunctionArgs:   p
                    }));
                }
            }).catch(function(e){
                // handle error
                e.thrownByFunction = 'query';
                e.thrownByFunctionArgs = p;
                reject(e);
            });
        }
    }));
}




/*
    getTicket({
        schema:             <form name>
        ticket:             <ticket number>
        fields:             [array, of, fieldnames, to, get, values, for] -- note add something for assoc stuff later
        fetchAttachments:   true | false (default false). if true, fetch the binary data for attachments and include in .data
    })
*/
getTicket(p){
    let self = this;
    return(new Promise(function(resolve, reject){

        // input validation
        let inputValid = true;

        // if we're not authenticated, don't bother
        if (! self.isAuthenticated){
            inputValid = false;
            reject(new ARSRestException({
                messageType:            'non-ars',
                message:                `operation requires authentication and api handle is not authenticated`,
                thrownByFunction:       'getTicket'
            }));
        }

        // arguments are required
        if (inputValid && (typeof(p) !== 'object')){
            inputValid = false;
            reject(new ARSRestException({
                messageType:            'non-ars',
                message:                `required inputs missing: given argument is not an object ${typeof(p)}`,
                thrownByFunction:       'getTicket'
            }));
        }

        // check args
        ['schema', 'fields', 'ticket'].forEach(function(a){
            if (! (inputValid && p.hasOwnProperty(a) && self.isNotNull(p[a]))){
                inputValid = false;
                reject(new ARSRestException({
                    messageType:            'non-ars',
                    message:                `required argument missing: ${a}`,
                    thrownByFunction:       'getTicket',
                    thrownByFunctionArgs:   p
                }));
            }
        });

        // default value for fetchAttachments
        if ((! p.hasOwnProperty('fetchAttachments')) || (p.fetchAttachments !== true)){ p.fetchAttachments = false; }


        // fields has to be an object too
        if (inputValid && (typeof(p.fields) !== 'object')){
            inputValid = false;
            reject(new ARSRestException({
                messageType:            'non-ars',
                message:                `required argument missing: 'fields' is not an object (${typeof(p.fields)})`,
                thrownByFunction:       'getTicket',
                thrownByFunctionArgs:   p
            }));
        }

        // do it. do it. do it 'till ya satisfied
        if (inputValid){
            let fieldTmp = [];
            p.fields.forEach(function(fieldName){
                fieldTmp.push(encodeURIComponent(fieldName));
            });

            new ARSRestDispatcher({
                endpoint: `${self.protocol}://${self.server}:${self.port}${(self.hasAttribute('proxyPath'))?self.proxyPath:''}/api/arsys/v1/entry/${encodeURIComponent(p.schema)}/${p.ticket}/?fields=values(${fieldTmp.join(",")})`,
                method:   'GET',
                headers:  {
                    "Authorization":    `AR-JWT ${self.token}`,
                    "Content-Type":     "application/x-www-form-urlencoded",
                    "Cache-Control":    "no-cache"
                },
                expectHtmlStatus: 200,
                timeout:    self.timeout
            }).go().then(function(xhr){
                // handle success

                /*
                    LOOSE END 6/19/18 @ 1505
                    we should be blessing the result into an ARResultList object
                    but of course first we need to write that class
                */

                try {
                    let resp = JSON.parse(xhr.responseText);
                    let promiseKeeper = [];

                    // handle getting attachments (if enabled)
                    if (p.fetchAttachments){
                        Object.keys(resp.values).forEach(function(field){
                            if ((typeof(resp.values[field]) == 'object') && resp.values[field].hasOwnProperty('name') && resp.values[field].hasOwnProperty('sizeBytes')){
                                if (self.debug){ console.log(`fetching attachment from field: ${field} with size: ${resp.values[field].sizeBytes} and filename: ${resp.values[field].name}`); }
                                promiseKeeper.push(
                                    self.getAttachment({
                                        schema:     p.schema,
                                        ticket:     p.ticket,
                                        fieldName:  field
                                    }).then(function(data){
                                        resp.values[field].data = data;
                                    })
                                );
                            }
                        });
                        Promise.all(promiseKeeper).then(function(p){
                            resolve(resp);
                        }).catch(function(e){
                            // e should already be blessed into ARSRestException
                            reject(e);
                        })

                    // don't need to look for attachments to fetch
                    }else{
                        resolve(JSON.parse(xhr.responseText));
                    }
                }catch (e){
                    reject(new ARSRestException({
                        messageType:            'non-ars',
                        message:                `failed to parse server response (JSON.parse): ${e}`,
                        thrownByFunction:       'getTicket',
                        thrownByFunctionArgs:   p
                    }));
                }
            }).catch(function(e){
                // handle error
                e.thrownByFunction = 'getTicket';
                e.thrownByFunctionArgs = p;
                reject(e);
            });

        }
    }));
}




/*
    getAttachment({
        schema:             <form name>
        ticket:             <ticket number>
        fieldName:          <attachment field name>
    })
*/
getAttachment(p){
    let self = this;
    return(new Promise(function(resolve, reject){

        // input validation
        let inputValid = true;

        // if we're not authenticated, don't bother
        if (! self.isAuthenticated){
            inputValid = false;
            reject(new ARSRestException({
                messageType:            'non-ars',
                message:                `operation requires authentication and api handle is not authenticated`,
                thrownByFunction:       'getAttachment'
            }));
        }

        // arguments are required
        if (inputValid && (typeof(p) !== 'object')){
            inputValid = false;
            reject(new ARSRestException({
                messageType:            'non-ars',
                message:                `required inputs missing: given argument is not an object ${typeof(p)}`,
                thrownByFunction:       'getAttachment'
            }));
        }

        // check args
        ['schema', 'ticket', 'fieldName'].forEach(function(a){
            if (! (inputValid && p.hasOwnProperty(a) && self.isNotNull(p[a]))){
                inputValid = false;
                reject(new ARSRestException({
                    messageType:            'non-ars',
                    message:                `required argument missing: ${a}`,
                    thrownByFunction:       'getAttachment',
                    thrownByFunctionArgs:   p
                }));
            }
        });

        // do it. do it. do it 'till ya satisfied
        if (inputValid){

            new ARSRestDispatcher({
                endpoint: `${self.protocol}://${self.server}:${self.port}${(self.hasAttribute('proxyPath'))?self.proxyPath:''}/api/arsys/v1/entry/${encodeURIComponent(p.schema)}/${p.ticket}/attach/${encodeURIComponent(p.fieldName)}`,
                method:   'GET',
                headers:  {
                    "Authorization":    `AR-JWT ${self.token}`,
                    //"Content-Type":     "application/x-www-form-urlencoded",
                    //"Cache-Control":    "no-cache"
                },
                expectHtmlStatus: 200,
                timeout:        self.timeout,
                responseType:   'arrayBuffer'
            }).go().then(function(xhr){
                // handle success

                /*
                    LOOSE END 6/25/18 @ 1645
                    my first thought was to make some kinda object model to represent
                    an attachment (something like {name: <>, size: <>, data: <>})
                    however, upon reflection, I think it's best that this function
                    returns the raw binary data in an array buffer.

                    you need to have data from the ticket to tell you how
                    big it is and what it's name is anyhow. so we can either
                    pass the user contextless binary (like we're doing), or
                    we can do an extra fetch and get the meta-data for the attachment
                    from the ticket.

                    OR ... we can add a getAttachments option to getTicket and
                    query. If you specify it, we just do the extra fetch to get
                    the binary data inside the original response.

                    you can call it yourself if you want to or just do it inside
                    the original call automatically, which is like a 90% use case
                    probably
                */
                resolve(xhr.responseText);
            }).catch(function(e){
                // handle error
                e.thrownByFunction = 'getAttachment';
                e.thrownByFunctionArgs = p;
                reject(e);
            });

        }
    }));
}




/*
    createTicket({
        schema:     <formName>,
        fields:     {fieldName:fieldValue ...},
    });
*/
createTicket(p){
    let self = this;
    return(new Promise(function(resolve, reject){

        // input validation
        let inputValid = true;

        // if we're not authenticated, don't bother
        if (! self.isAuthenticated){
            inputValid = false;
            reject(new ARSRestException({
                messageType:            'non-ars',
                message:                `operation requires authentication and api handle is not authenticated`,
                thrownByFunction:       'createTicket'
            }));
        }

        // arguments are required
        if (inputValid && (typeof(p) !== 'object')){
            inputValid = false;
            reject(new ARSRestException({
                messageType:            'non-ars',
                message:                `required inputs missing: given argument is not an object ${typeof(p)}`,
                thrownByFunction:       'createTicket'
            }));
        }

        // check args
        ['schema', 'fields'].forEach(function(a){
            if (inputValid && ((! p.hasOwnProperty(a)) || self.isNull(p[a]))){
                inputValid = false;
                reject(new ARSRestException({
                    messageType:            'non-ars',
                    message:                `required argument missing: ${a}`,
                    thrownByFunction:       'createTicket',
                    thrownByFunctionArgs:   p
                }));
            }
        });

        // fields has to be an object too
        if (inputValid && (typeof(p.fields) !== 'object')){
            inputValid = false;
            reject(new ARSRestException({
                messageType:            'non-ars',
                message:                `required argument missing: 'fields' is not an object (${typeof(p.fields)})`,
                thrownByFunction:       'createTicket',
                thrownByFunctionArgs:   p
            }));
        }

        /*
            LEFT OFF HERE - 6/26/18 @ 1054
            next step is to hack sending attachments onto createTicket and mergeData
            to do that, ARSRestDispatcher needs to know how to send multipart/form-data
            requests as described here:

            https://docs.bmc.com/docs/ars1805/entry-formname-804716411.html#id-/entry/{formName}-Createanentrywithattachments

            just doing this in node by brute-force formatting everything up and sending
            it is definitely possible, HOWEVER our goal with this library is to do
            everything on the legit XHR api interface so we can just drop the whole
            shebang into a browser verbatim.

            That being the case, what we actually need to do is to extend the XHR
            shim library for node to support the new(ish) FormData API as described
            here:

            https://developer.mozilla.org/en-US/docs/Web/API/FormData

            also of interest:

            https://developer.mozilla.org/en-US/docs/Learn/HTML/Forms/Sending_forms_through_JavaScript
            https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS

            once we've got the XMLHttpRequest node emulation library supporting the FormData
            API, then we can code up ARSRestDispatcher to send multipart/form-data and we can
            send values to attachment fields in the library.

            for now, it supports retrieving attachments but not sending them.
        */

        // woohah! i gochu-all-incheck!
        if (inputValid){
            new ARSRestDispatcher({
                endpoint: `${self.protocol}://${self.server}:${self.port}${(self.hasAttribute('proxyPath'))?self.proxyPath:''}/api/arsys/v1/entry/${encodeURIComponent(p.schema)}`,
                method:   'POST',
                headers:  {
                    "Authorization":    `AR-JWT ${self.token}`,
                    "Content-Type":     "application/json",
                    "Cache-Control":    "no-cache"
                },
                content:  {values:p.fields},
                expectHtmlStatus: 201,
                timeout:    self.timeout
            }).go().then(function(xhr){
                // handle success

                /*
                    LOOSE END 6/19/18 @ 1555
                    we should be blessing the result into an ARRecordId object
                    but of course first we need to write that class
                    for now it's: { url:<url>, entryId: <entryId>}
                */

                try {
                    let strang = xhr.getResponseHeader('location');
                    let parse = strang.split('/');
                    let ticket = parse[(parse.length -1)];
                    resolve({
                        url:        strang,
                        entryId:    ticket
                    });
                }catch (e){
                    reject(new ARSRestException({
                        messageType:            'non-ars',
                        message:                `failed to parse server response for record identification (create successful?): ${e}`,
                        thrownByFunction:       'createTicket',
                        thrownByFunctionArgs:   p
                    }));
                }
            }).catch(function(e){
                // handle error
                e.thrownByFunction = 'createTicket';
                e.thrownByFunctionArgs = p;
                reject(e);
            });
        }
    }));
}




/*
    modifyTicket({
        schema:     <formName>,
        ticket:     <entryId>.
        fields:     {fieldName:fieldValue ...},
    });
*/
modifyTicket(p){
    let self = this;
    return(new Promise(function(resolve, reject){

        // input validation
        let inputValid = true;

        // if we're not authenticated, don't bother
        if (! self.isAuthenticated){
            inputValid = false;
            reject(new ARSRestException({
                messageType:            'non-ars',
                message:                `operation requires authentication and api handle is not authenticated`,
                thrownByFunction:       'modifyTicket'
            }));
        }

        // arguments are required
        if (inputValid && (typeof(p) !== 'object')){
            inputValid = false;
            reject(new ARSRestException({
                messageType:            'non-ars',
                message:                `required inputs missing: given argument is not an object ${typeof(p)}`,
                thrownByFunction:       'modifyTicket'
            }));
        }

        // check args
        ['schema', 'fields', 'ticket'].forEach(function(a){
            if (inputValid && ((! p.hasOwnProperty(a)) || self.isNull(p[a]))){
                inputValid = false;
                reject(new ARSRestException({
                    messageType:            'non-ars',
                    message:                `required argument missing: ${a}`,
                    thrownByFunction:       'modifyTicket',
                    thrownByFunctionArgs:   p
                }));
            }
        });

        // fields has to be an object too
        if (inputValid && (typeof(p.fields) !== 'object')){
            inputValid = false;
            reject(new ARSRestException({
                messageType:            'non-ars',
                message:                `required argument missing: 'fields' is not an object (${typeof(p.fields)})`,
                thrownByFunction:       'modifyTicket',
                thrownByFunctionArgs:   p
            }));
        }

        // been smoove since days of underoos ...
        if (inputValid){
            new ARSRestDispatcher({
                endpoint: `${self.protocol}://${self.server}:${self.port}${(self.hasAttribute('proxyPath'))?self.proxyPath:''}/api/arsys/v1/entry/${encodeURIComponent(p.schema)}/${p.ticket}`,
                method:   'PUT',
                headers:  {
                    "Authorization":    `AR-JWT ${self.token}`,
                    "Content-Type":     "application/json",
                    "Cache-Control":    "no-cache"
                },
                content:  {values:p.fields},
                expectHtmlStatus: 204,
                timeout:    self.timeout
            }).go().then(function(xhr){
                // handle success
                resolve(true);
            }).catch(function(e){
                // handle error
                e.thrownByFunction = 'modifyTicket';
                e.thrownByFunctionArgs = p;
                reject(e);
            });
        }
    }));
}




/*
    deleteTicket({
        schema:     <formName>,
        ticket:     <entryID>
    })
*/
deleteTicket(p){
    let self = this;
    return(new Promise(function(resolve, reject){

        // input validation
        let inputValid = true;

        // if we're not authenticated, don't bother
        if (! self.isAuthenticated){
            inputValid = false;
            reject(new ARSRestException({
                messageType:            'non-ars',
                message:                `operation requires authentication and api handle is not authenticated`,
                thrownByFunction:       'deleteTicket'
            }));
        }

        // arguments are required
        if (inputValid && (typeof(p) !== 'object')){
            inputValid = false;
            reject(new ARSRestException({
                messageType:            'non-ars',
                message:                `required inputs missing: given argument is not an object ${typeof(p)}`,
                thrownByFunction:       'deleteTicket'
            }));
        }

        // check args
        ['schema', 'ticket'].forEach(function(a){
            if (inputValid && ((! p.hasOwnProperty(a)) || self.isNull(p[a]))){
                inputValid = false;
                reject(new ARSRestException({
                    messageType:            'non-ars',
                    message:                `required argument missing: ${a}`,
                    thrownByFunction:       'deleteTicket',
                    thrownByFunctionArgs:   p
                }));
            }
        });

        // now here's the real dukey, meanin' whose really the 'ish
        if (inputValid){
            new ARSRestDispatcher({
                endpoint: `${self.protocol}://${self.server}:${self.port}${(self.hasAttribute('proxyPath'))?self.proxyPath:''}/api/arsys/v1/entry/${encodeURIComponent(p.schema)}/${p.ticket}`,
                method:   'DELETE',
                headers:  {
                    "Authorization":    `AR-JWT ${self.token}`,
                    "Content-Type":     "application/json",
                    "Cache-Control":    "no-cache"
                },
                expectHtmlStatus: 204,
                timeout:    self.timeout
            }).go().then(function(xhr){
                // handle success
                resolve(p.ticket);
            }).catch(function(e){
                // handle error
                e.thrownByFunction = 'deleteTicket';
                e.thrownByFunctionArgs = p;
                reject(e);
            });
        }
    }));
}




/*
    mergeData({
        schema:                 <formName>
        fields:                 {fieldOne:valueOne, fieldTwo:valueTwo ...}
        QBE:                    <qualification> (optional)
        handleDuplicateEntryId: error | create | overwrite | merge | alwaysCreate (default error)
        ignorePatterns:         <bool> (default false)
        ignoreRequired:         <bool> (default false)
        workflowEnabled:        <bool> (default true)
        associationsEnabled:    <bool> (default true)
        multimatchOption:       error | useFirstMatching (default error)
    })
*/
mergeData(p){
    let self = this;
    return(new Promise(function(resolve, reject){

        // input validation
        let inputValid = true;

        // if we're not authenticated, don't bother
        if (! self.isAuthenticated){
            inputValid = false;
            reject(new ARSRestException({
                messageType:            'non-ars',
                message:                `operation requires authentication and api handle is not authenticated`,
                thrownByFunction:       'mergeData'
            }));
        }

        // arguments are required
        if (inputValid && (typeof(p) !== 'object')){
            inputValid = false;
            reject(new ARSRestException({
                messageType:            'non-ars',
                message:                `required inputs missing: given argument is not an object ${typeof(p)}`,
                thrownByFunction:       'mergeData'
            }));
        }

        // check args
        ['schema', 'fields'].forEach(function(a){
            if (inputValid && ((! p.hasOwnProperty(a)) || self.isNull(p[a]))){
                inputValid = false;
                reject(new ARSRestException({
                    messageType:            'non-ars',
                    message:                `required argument missing: ${a}`,
                    thrownByFunction:       'mergeData',
                    thrownByFunctionArgs:   p
                }));
            }
        });

        // fields has to be an object too
        if (inputValid && (typeof(p.fields) !== 'object')){
            inputValid = false;
            reject(new ARSRestException({
                messageType:            'non-ars',
                message:                `required argument missing: 'fields' is not an object (${typeof(p.fields)})`,
                thrownByFunction:       'mergeData',
                thrownByFunctionArgs:   p
            }));
        }

        // validate handleDuplicateEntryId
        let mergeTypeDecoder = {
            error:          "DUP_ERROR",
            create:         "DUP_NEW_ID",
            overwrite:      "DUP_OVERWRITE",
            merge:          "DUP_MERGE",
            alwaysCreate:   "GEN_NEW_ID"
        };
        if ((! p.hasOwnProperty('handleDuplicateEntryId')) || (self.isNull(p.handleDuplicateEntryId))){ p.handleDuplicateEntryId = "error"; }
        if (inputValid && (! mergeTypeDecoder.hasOwnProperty(p.handleDuplicateEntryId))){
            inputValid = false;
            reject(new ARSRestException({
                messageType:            'non-ars',
                message:                `invalid value (handleDuplicateEntryId): ${p.handleDuplicateEntryId}`,
                thrownByFunction:       'mergeData',
                thrownByFunctionArgs:   p
            }));
        }

        // validate multimatchOption
        let multimatchOptionDecoder = {
            error:              0,
            useFirstMatching:   1
        };
        if ((! p.hasOwnProperty('multimatchOption')) || (self.isNull(p.multimatchOption))){ p.multimatchOption = "error"; }
        if (inputValid && (! multimatchOptionDecoder.hasOwnProperty(p.multimatchOption))){
            inputValid = false;
            reject(new ARSRestException({
                messageType:            'non-ars',
                message:                `invalid value (multimatchOption): ${p.multimatchOption}`,
                thrownByFunction:       'mergeData',
                thrownByFunctionArgs:   p
            }));
        }

        // handle default boolean options
        if (! ((p.hasOwnProperty('ignorePatterns') && (p.ignorePatterns === true )))){ p.ignorePatterns = false; }
        if (! ((p.hasOwnProperty('ignoreRequired') && (p.ignoreRequired === true)))){ p.ignoreRequired = false; }
        if (! ((p.hasOwnProperty('workflowEnabled') && (p.workflowEnabled === false)))){ p.ignoreRequired = true; }
        if (! ((p.hasOwnProperty('associationsEnabled') && (p.associationsEnabled === false)))){ p.associationsEnabled = true; }


        // shedonealreadydonehadherses
        if (inputValid){

            let body = {
                values:         p.fields,
                mergeOptions:   {
                    mergeType:              mergeTypeDecoder[p.handleDuplicateEntryId],
                    multimatchOption:       multimatchOptionDecoder[p.multimatchOption],
                    ignorePatterns:         p.ignorePatterns,
                    ignoreRequired:         p.ignoreRequired,
                    workflowEnabled:        p.workflowEnabled,
                    associationsEnabled:    p.associationsEnabled
                }
            };
            if (p.hasOwnProperty('QBE') && (self.isNotNull(p.QBE))){ body.qualification = p.QBE; }

            new ARSRestDispatcher({
                endpoint: `${self.protocol}://${self.server}:${self.port}${(self.hasAttribute('proxyPath'))?self.proxyPath:''}/api/arsys/v1/mergeEntry/${encodeURIComponent(p.schema)}`,
                method:   'POST',
                headers:  {
                    "Authorization":    `AR-JWT ${self.token}`,
                    "Content-Type":     "application/json",
                    "Cache-Control":    "no-cache"
                },
                expectHtmlStatus: [201, 204],
                content: body,
                timeout:    self.timeout
            }).go().then(function(xhr){

                // handle success

                /*
                    LOOSE END 6/19/18 @ 1634
                    we should be blessing the result into an ARRecordId object
                    but of course first we need to write that class
                    for now it's: { url:<url>, entryId: <entryId>}
                */

                try {
                    let strang = xhr.getResponseHeader('location');
                    let parse = strang.split('/');
                    let ticket = parse[(parse.length -1)];
                    resolve({
                        url:        strang,
                        entryId:    ticket
                    });
                }catch (e){
                    reject(new ARSRestException({
                        messageType:            'non-ars',
                        message:                `failed to parse server response for record identification (merge successful?): ${e}`,
                        thrownByFunction:       'mergeData',
                        thrownByFunctionArgs:   p
                    }));
                }
            }).catch(function(e){
                // handle error
                e.thrownByFunction = 'mergeData';
                e.thrownByFunctionArgs = p;
                reject(e);
            });
        }
    }));
}



} // end RemedyRestAPI class




// hook for node
module.exports = RemedyRestAPI;
