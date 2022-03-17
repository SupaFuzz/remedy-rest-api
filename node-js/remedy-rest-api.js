/*
    remedy-rest-api.js (node version)
    Amy Hicox <amy@hicox.com> 3/11/22 ❤️
*/




/*
    NODE STUFF
*/
'use strict';

// trust shady SSL certs
//process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";




/*
    ObjectCore class
*/
class ObjectCore {

// constructor(args, defaults, callback)
constructor (args, defaults){

    // merge class defaults with constructor defaults
    let masterKeyList = Object.assign(

        // this class defaults
        {
            _className: 'ObjectCore',
            _version:   1,
            _usedGUIDs: [],
            usedGUIDMaxCache:   1000
        },

        // pass through class defaults
        (defaults instanceof Object)?defaults:{},

        // args
        (args instanceof Object)?args:{}
    );

    // create attributes for everything.
    Object.keys(masterKeyList).forEach(function(key){
        Object.defineProperty(this, key, {
            value:        masterKeyList[key],
            writable:     true,
            enumerable:   (! (/^_/.test(key))),
            configurable: true
        });
    }, this);

} // end constructor


/*
    isNull(value)
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
    epochTimestamp(hiResBool)
*/
epochTimestamp(bool){
    if (bool === true){
        return(new Date().getTime());
    }else{
        return(Math.round(new Date().getTime() / 1000));
    }
}


/*
    hasAttribute(attributeName)
    return true if this has <attributeName> and
    the value of that attribute is not null
*/
hasAttribute(attributeName){
    return(this.hasOwnProperty(attributeName) && this.isNotNull(this[attributeName]));
}




/*
    getGUID()
    return a GUID. These are just random, but we do at least keep
    track of the ones we've issued and won't issue the same one
    twice within the same run instance
*/
getGUID(){
    let guid;
    do {
        // thank you stackoverflow!
        guid = 'ncxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            let r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
            return v.toString(16);
        });
    } while (this._usedGUIDs.indexOf(guid) >= 0);
    this._usedGUIDs.push(guid);
    if (this._usedGUIDs.length > this.usedGUIDMaxCache){ this._usedGUIDs.shift(); }
    return(guid);
}

} // end ObjectCore class




/*
    RemedyRestAPIException({args})
*/
class RemedyRestAPIException extends ObjectCore {

/*
    constructor({
        message:                <str>
        messageType:            <'non-ars' || arsErrorList[0].messageType>
        thrownByFunction:       <str>
        thrownByFunctionArgs:   <obj>
        arsErrorList:           <array of { messageType: <str>, messageText: <str>, messageAppendedText: <str>, messageNumber: <int> }>
    })
*/
constructor(args){
    super(args, {
        _version:            2.6,
        _className:          'RemedyRestAPIException',
        _message:            '',
        _messageType:        '',
        httpResponseHeaders: {},
        arsErrorList:        []
    });

    // set the timestamp
    this.time = this.epochTimestamp(true);

} // end constructor

/*
    getter and setter for 'message'
    return this.message if it's set otherwise the first
    messageText from arsErrorList, if we have it, or null
*/
set message(v){ this._message = v; }
get message(){
    if (this.hasAttribute('_message')){
        return(this._message);
    }else{
        return(
            (
                (this.arsErrorList[0] instanceof Object) &&
                this.arsErrorList[0].hasOwnProperty('messageText') &&
                this.isNotNull(this.arsErrorList[0].messageText)
            )?this.arsErrorList[0].messageText:null
        );
    }
}

// same for messageType
set messageType(v){ this._messageType = v; }
get messageType(){
    if (this.hasAttribute('_messageType')){
        return(this._messageType);
    }else{
        return(
            (
                (this.arsErrorList[0] instanceof Object) &&
                this.arsErrorList[0].hasOwnProperty('messageType') &&
                this.isNotNull(this.arsErrorList[0].messageType)
            )?this.arsErrorList[0].messageType:null
        );
    }
}

/*
    getters for arsErrorList properties
    all default to the first entry in arsErrorList or false
*/
get messageText(){
    return((
        (this.arsErrorList[0] instanceof Object) &&
        this.arsErrorList[0].hasOwnProperty('messageText') &&
        this.isNotNull(this.arsErrorList[0].messageText)
    )?this.arsErrorList[0].messageText:null);
}
get messageAppendedText(){
    return((
        (this.arsErrorList[0] instanceof Object) &&
        this.arsErrorList[0].hasOwnProperty('messageAppendedText') &&
        this.isNotNull(this.arsErrorList[0].messageAppendedText)
    )?this.arsErrorList[0].messageAppendedText:null);
}
get messageNumber(){
    return((
        (this.arsErrorList[0] instanceof Object) &&
        this.arsErrorList[0].hasOwnProperty('messageNumber') &&
        this.isNotNull(this.arsErrorList[0].messageNumber)
    )?this.arsErrorList[0].messageNumber:null);
}

/*
    return a nice string
*/
toString(){
    return(`[${this.messageType}${this.isNotNull(this.messageNumber)?' ('+this.messageNumber+')':''}]: ${this.message}${this.isNotNull(this.messageAppendedText)?' / '+this.messageAppendedText:''}`);
}

} // end RemedyRestAPIException class




/*
    RemedyRestAPI class
*/
class RemedyRestAPI extends ObjectCore {


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
        _version:   1,
        _className: 'RemedyRestAPI',
        debug:      false,
        protocol:   'https',
        timeout:    (60 * 1000 * 2)     // <-- 2 minute default timeout
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
            throw(`unsupported protocol: ${this.protocol}`);
    }

} // end constructor




/*
    apiFetch({args})
    args = {
        endpoint:           <url>
        method:             <POST, GET, etc>
        expectHtmlStatus:   <int>
        headers:            <obj>
        body:               <str | obj>
        encodeBody:         <bool, default: false>
    }
*/
apiFetch(p){
    let that = this;
    return(new Promise(function(toot, boot){

        // merge args to default values
        let args = Object.assign({
            encodeBody: false,
            expectHtmlStatus: 200
        }, (p instanceof Object)?p:{});

        /* insert bounce for missing args here */

        // setup fetchArgs
        let fetchArgs = {
            method: args.method,
            headers: args.headers,
            cache: 'no-cache'
        };

        if (args.hasOwnProperty('body')){
            if ((args.body instanceof Object) && (args.encodeBody == true)){
                fetchArgs.body = JSON.stringify(args.body);
            }else{
                fetchArgs.body = args.body;
            }
        }

        let abort = false;
        fetch(args.endpoint, fetchArgs).catch(function(error){
            abort = true;
            boot(new RemedyRestAPIException({
                messageType: 'non-ars',
                message: error,
                thrownByFunction: `${that._className} v${that._version} | apiFetch()`,
                thrownByFunctionArgs: args
            }));
        }).then(function(response){
            if (that.debug){ console.log(`${that._className} v${that._version} | apiFetch() | ${args.endpoint} | ${(response.ok)?'OK | ':''}${response.status}: ${response.statusText}`); }

            if (
                ((args.expectHtmlStatus instanceof Array) && (args.expectHtmlStatus.indexOf(response.status) < 0)) ||
                ((! (args.expectHtmlStatus instanceof Array)) && (response.status !== args.expectHtmlStatus))
            ){
                // failure
                let parseAbort = false;
                let errorArgs = {
                    thrownByFunction: `${that._className} v${that._version} | apiFetch()`,
                    thrownByFunctionArgs: args,
                    message: `got http status: ${response.status} instead of ${args.expectHtmlStatus}`
                };
                response.json().catch(function(error){
                    // handle unparsable error
                    parseAbort = true;
                }).then(function(errorData){
                    if (! parseAbort){
                        errorArgs.arsErrorList = errorData;
                        if ((errorData instanceof Array) && (errorData[0] instanceof Object) && errorData[0].hasOwnProperty('messageText') && that.isNotNull(errorData[0].messageText)){
                            errorArgs.message += ` | ${errorData[0].messageText}`;
                        }
                    }
                    boot(new RemedyRestAPIException(errorArgs));
                });
            }else{
                // success: just return the response object and let the caller deal with it
                toot(response);
            }
        });
    }));
} // end apiFetch




/*
    isAuthenticated
    return true if we have an api session token, else false
*/
get isAuthenticated(){
    return(this.hasAttribute('token'));
}




/*
    authenticate()
*/
authenticate(p){
    let that = this;
    let args = (p instanceof Object)?p:{};
    return(new Promise(function(toot, boot){

        // check args
        let missingArgs = [];
        ['protocol','server','user','password', 'port'].forEach(function(arg){
            if (! (args.hasOwnProperty(arg) && that.isNotNull(args[arg]))){
                if (that.hasAttribute(arg)){
                    args[arg] = that[arg];
                }else{
                    missingArgs.push(arg);
                }
            }
        });
        if (missingArgs.length > 0){
            boot(`${that._className} v${that._version} | authenticate() | missing args: ${missingArgs.join(", ")}`);
        }else{

            // the rest endpoint
            let endpoint = `${args.protocol}://${args.server}:${args.port}${(that.hasAttribute('proxyPath'))?that.proxyPath:''}/api/jwt/login`;
            if (that.debug){ console.log(`${that._className} v${that._version} | authenticate() | ${endpoint}`); }

            let abort = false;
            that.apiFetch({
                endpoint: endpoint,
                method: 'POST',
                headers: {
                    "Content-Type":     "application/x-www-form-urlencoded",
                    "Cache-Control":    "no-cache"
                },
                body:  `username=${args.user}&password=${args.password}`,
                expectHtmlStatus: 200
            }).catch(function(error){
                abort = true;
                boot(error);
            }).then(function(response){
                if (! abort){
                    let parseAbort = false;
                    response.text().catch(function(error){
                        parseAbort = true;
                        boot(new RemedyRestAPIException({
                            messageType: 'non-ars',
                            message: `${that._className} v${that._version} | authenticate() | response parse error: ${error}`,
                            thrownByFunction: `${that._className} v${that._version} | apiFetch()`,
                            thrownByFunctionArgs: args
                        }));
                    }).then(function(responseText){
                        if (! parseAbort){
                            that.token = responseText;
                            toot(that);
                        }
                    });
                }
            });
        }
    }));
} // end authenticate()




/*
    logout()
*/
logout(p){
    let that = this;
    let args = (p instanceof Object)?p:{};
    return(new Promise(function(toot, boot){

        // bounce if not authenticated
        if (! that.isAuthenticated){
            boot(new RemedyRestAPIException({
                messageType: 'non-ars',
                message: `${that._className} v${that._version} | logout() | api handle is not authenticated`,
                thrownByFunction: `${that._className} v${that._version} | logout()`,
                thrownByFunctionArgs: args
            }));
        }else{

            // check args
            let missingArgs = [];
            ['protocol','server','token', 'port'].forEach(function(arg){
                if (! (args.hasOwnProperty(arg) && that.isNotNull(args[arg]))){
                    if (that.hasAttribute(arg)){
                        args[arg] = that[arg];
                    }else{
                        missingArgs.push(arg);
                    }
                }
            });
            if (missingArgs.length > 0){
                boot(new RemedyRestAPIException({
                    messageType: 'non-ars',
                    message: `${that._className} v${that._version} | logout() | missing args: ${missingArgs.join(", ")}`,
                    thrownByFunction: `${that._className} v${that._version} | logout()`,
                    thrownByFunctionArgs: args
                }));
            }else{

                // the rest endpoint
                let endpoint = `${args.protocol}://${args.server}:${args.port}${(that.hasAttribute('proxyPath'))?that.proxyPath:''}/api/jwt/logout`;
                if (that.debug){ console.log(`${that._className} v${that._version} | logout() | ${endpoint}`); }

                // new hotness!
                let abort = false;
                that.apiFetch({
                    endpoint: endpoint,
                    method: 'POST',
                    headers: {
                        "Authorization":    `AR-JWT ${that.token}`,
                        "Cache-Control":    "no-cache",
                        "Content-Type":     "application/x-www-form-urlencoded"
                    },
                    expectHtmlStatus: 204
                }).catch(function(error){
                    abort = true;
                    error.message = `${that._className} v${that._version} | logout() | ${error}`;
                    error.thrownByFunction = `${that._className} v${that._version} | logout() -> apiFetch()`;
                    boot(error);
                }).then(function(response){
                    if (! abort){
                        delete (that.token);
                        toot(true);
                    }
                });

            } // end "args not missing"
        } // end "if not authenticated"
    }));
} // end logout()




/*
    getAttachment()
*/
getAttachment(p){
    let that = this;
    let functionName = 'getAttachment';

    // merge function args to object server connect properties
    let args = Object.assign({
        protocol: that.protocol,
        server:   that.server,
        port:     that.port
    }, (p instanceof Object)?p:{});

    return(new Promise(function(toot, boot){

        // bounce if not authenticated
        if (! that.isAuthenticated){
            boot(new RemedyRestAPIException({
                messageType: 'non-ars',
                message: `${that._className} v${that._version} | ${functionName}() | api handle is not authenticated`,
                thrownByFunction: `${that._className} v${that._version} | ${functionName}()`,
                thrownByFunctionArgs: args
            }));
        }else{

            // bounce for missing args
            let missingArgs = [];
            ['protocol', 'server', 'port', 'schema', 'ticket', 'fieldName'].forEach(function(arg){
                if (! (args.hasOwnProperty(arg) && that.isNotNull(args[arg]))){ missingArgs.push(arg); }
            });
            if (missingArgs.length > 0){
                boot(new RemedyRestAPIException({
                    messageType: 'non-ars',
                    message: `${that._className} v${that._version} | ${functionName}() | missing args: ${missingArgs.join(", ")}`,
                    thrownByFunction: `${that._className} v${that._version} | ${functionName}()`,
                    thrownByFunctionArgs: args
                }));
            }else{

                // the rest endpoint
                let endpoint = `${args.protocol}://${args.server}:${args.port}${(that.hasAttribute('proxyPath'))?that.proxyPath:''}/api/arsys/v1/entry/${encodeURIComponent(args.schema)}/${args.ticket}/attach/${encodeURIComponent(args.fieldName)}`;
                if (that.debug){ console.log(`${that._className} v${that._version} | ${functionName}() | ${endpoint}`); }

                let abort = false;
                that.apiFetch({
                    endpoint:         endpoint,
                    method:           'GET',
                    expectHtmlStatus: 200,
                    headers:{
                        "Authorization":    `AR-JWT ${that.token}`
                    }
                }).catch(function(error){
                    abort = true;
                    error.message = `${that._className} v${that._version} | ${functionName}() | ${error}`;
                    error.thrownByFunction = `${that._className} v${that._version} | ${functionName}() -> apiFetch()`;
                    boot(error);
                }).then(function(response){ if (! abort){
                    let parseAbort = false;
                    response.blob().catch(function(error){
                        parseAbort = true;
                        boot(new RemedyRestAPIException({
                            messageType: 'non-ars',
                            message: `${that._className} v${that._version} | ${functionName}() | response parse error (as blob): ${error}`,
                            thrownByFunction: `${that._className} v${that._version} | ${functionName}()`,
                            thrownByFunctionArgs: args
                        }));
                    }).then(function(blob){ if (! parseAbort){
                        toot(blob);
                    }});
                }});
            }
        }
    }));
}




/*
    query()
*/
query(p){
    let that = this;
    let functionName = 'query';

    // merge function args to object server connect properties
    let args = Object.assign({
        protocol:           that.protocol,
        server:             that.server,
        port:               that.port,
        fetchAttachments:   false,
        getAssociations:    false,
        expandAssociations: false

    }, (p instanceof Object)?p:{});

    return(new Promise(function(toot, boot){

        // bounce if not authenticated
        if (! that.isAuthenticated){
            boot(new RemedyRestAPIException({
                messageType: 'non-ars',
                message: `${that._className} v${that._version} | ${functionName}() | api handle is not authenticated`,
                thrownByFunction: `${that._className} v${that._version} | ${functionName}()`,
                thrownByFunctionArgs: args
            }));
        }else{

            // bounce for missing args
            let missingArgs = [];
            ['protocol', 'server', 'port', 'schema', 'fields', 'QBE'].forEach(function(arg){
                if (! (args.hasOwnProperty(arg) && that.isNotNull(args[arg]))){ missingArgs.push(arg); }
            });
            if (missingArgs.length > 0){
                boot(new RemedyRestAPIException({
                    messageType: 'non-ars',
                    message: `${that._className} v${that._version} | ${functionName}() | missing args: ${missingArgs.join(", ")}`,
                    thrownByFunction: `${that._className} v${that._version} | ${functionName}()`,
                    thrownByFunctionArgs: args
                }));
            }else{

                // bounce for fields not being an object
                if (! (args.hasOwnProperty('fields') && (args.fields instanceof Array))){
                    boot(new RemedyRestAPIException({
                        messageType: 'non-ars',
                        message: `${that._className} v${that._version} | ${functionName}() | required argument 'fields' is not an array`,
                        thrownByFunction: `${that._className} v${that._version} | ${functionName}()`,
                        thrownByFunctionArgs: args
                    }));
                }else{
                    // the rest endpoint
                    let url = `${args.protocol}://${args.server}:${args.port}${(that.hasAttribute('proxyPath'))?that.proxyPath:''}/api/arsys/v1/entry/${encodeURIComponent(args.schema)}/?q=${encodeURIComponent(args.QBE)}&fields=values(${args.fields.join(",")})`;

                    /*
                        associations:
                            * getAssociations <bool> || array
                              if null or boolean false: do nothing
                              if boolean true: get a list of all associations   url += `,assoc`
                              if array: get associationNames listed             url += `,assoc(getAssociations.join(','))`

                            * expandAssociations <bool>
                              if true and getAssociations is an array, expand (get fieldValues for) the associations listed in getAssociations
                              url += `&expand=assoc(getAssociations.join(','))`
                    */
                    if (args.hasOwnProperty('getAssociations')){
                        if (args.getAssociations === true){
                            url += `,assoc`;
                        }else if (args.getAssociations instanceof Array){
                            let as = [];
                            as = args.getAssociations;
                            if (args.hasOwnProperty('expandAssociations') && (args.expandAssociations === true)){
                                url += `&expand=assoc(${as.join(',')})`;
                            }else{
                                url += `,assoc(${as.join(',')})`;
                            }
                        }
                    }

                    // paging stuffs
                    ['offset', 'limit', 'sort'].forEach(function(a){
                        if ((args.hasOwnProperty(a)) && (that.isNotNull(p[a]))){
                            url += `&${a}=${encodeURIComponent(p[a])}`;
                        }
                    });
                    if (that.debug){ console.log(`${that._className} v${that._version} | ${functionName}() | ${url}`); }

                    let abort = false;
                    that.apiFetch({
                        endpoint:           url,
                        method:             'GET',
                        expectHtmlStatus:   200,
                        headers: {
                            "Authorization":    `AR-JWT ${that.token}`,
                            "Content-Type":     "application/x-www-form-urlencoded",
                            "Cache-Control":    "no-cache"
                        }
                    }).catch(function(error){
                        abort = true;
                        error.message = `${that._className} v${that._version} | ${functionName}() | ${error}`;
                        error.thrownByFunction = `${that._className} v${that._version} | ${functionName}() -> apiFetch()`;
                        boot(error);
                    }).then(function(response){ if (! abort){
                        let parseAbort = false;
                        response.json().catch(function(error){
                            parseAbort = true;
                            boot(new RemedyRestAPIException({
                                messageType: 'non-ars',
                                message: `${that._className} v${that._version} | ${functionName}() | response json parse error: ${error}`,
                                thrownByFunction: `${that._className} v${that._version} | ${functionName}()`,
                                thrownByFunctionArgs: args
                            }));
                        }).then(function(data){
                            if (args.fetchAttachments == true){
                                let pk = [];
                                data.entries.forEach(function(row){
                                    if (row.hasOwnProperty('_links') && row._links.hasOwnProperty('self') && row._links.self[0].hasOwnProperty('href')){
                                        let parse = row._links.self[0].href.split('/');
                                        let ticket = parse[(parse.length -1)];

                                        // find attachment fields if there are any
                                        Object.keys(row.values).forEach(function(field){
                                            if (that.isNotNull(row.values[field])){
                                                if ((row.values[field] instanceof Object) && row.values[field].hasOwnProperty('name') && row.values[field].hasOwnProperty('sizeBytes')){
                                                    if (that.debug){ console.log(`${that._className} v${that._version} | ${functionName}() | fetching attachment from record: ${ticket} and field: ${field} with size: ${row.values[field].sizeBytes} and filename: ${row.values[field].name}`); }
                                                    pk.push(new Promise(function(t, b){
                                                        let a = false;
                                                        that.getAttachment({
                                                            schema:     args.schema,
                                                            ticket:     ticket,
                                                            fieldName:  field
                                                        }).catch(function(error){
                                                            a = true;
                                                            error.message = `${that._className} v${that._version} | ${functionName}() -> getAttachment(${ticket}/${field}) | ${error}`;
                                                            error.thrownByFunction = `${that._className} v${that._version} | ${functionName}() -> getAttachment()`;
                                                            b(error);
                                                        }).then(function(dta){ if (! a){
                                                            row.values[field].data = dta;
                                                            t(true);
                                                        }});
                                                    }));
                                                }
                                            }
                                        });
                                    }
                                });
                                let mbort = false;
                                Promise.all(pk).catch(function(error){
                                    mbort = true;
                                    boot(error);
                                }).then(function(){
                                    if (! mbort){ toot(data); }
                                });
                            }else{
                                toot(data)
                            }
                        });
                    }});
                }
            }
        }
    }));
}




/*
    getTicket()
*/
getTicket(p){
    let that = this;
    let functionName = 'getTicket';

    // merge function args to object server connect properties
    let args = Object.assign({
        protocol:           that.protocol,
        server:             that.server,
        port:               that.port,
        fetchAttachments:   false,
        getAssociations:    false,
        expandAssociations: false

    }, (p instanceof Object)?p:{});

    return(new Promise(function(toot, boot){

        // bounce if not authenticated
        if (! that.isAuthenticated){
            boot(new RemedyRestAPIException({
                messageType: 'non-ars',
                message: `${that._className} v${that._version} | ${functionName}() | api handle is not authenticated`,
                thrownByFunction: `${that._className} v${that._version} | ${functionName}()`,
                thrownByFunctionArgs: args
            }));
        }else{

            // bounce for missing args
            let missingArgs = [];
            ['protocol', 'server', 'port', 'schema', 'fields', 'ticket'].forEach(function(arg){
                if (! (args.hasOwnProperty(arg) && that.isNotNull(args[arg]))){ missingArgs.push(arg); }
            });
            if (missingArgs.length > 0){
                boot(new RemedyRestAPIException({
                    messageType: 'non-ars',
                    message: `${that._className} v${that._version} | ${functionName}() | missing args: ${missingArgs.join(", ")}`,
                    thrownByFunction: `${that._className} v${that._version} | ${functionName}()`,
                    thrownByFunctionArgs: args
                }));
            }else{

                // bounce for fields not being an object
                if (! (args.hasOwnProperty('fields') && (args.fields instanceof Array))){
                    boot(new RemedyRestAPIException({
                        messageType: 'non-ars',
                        message: `${that._className} v${that._version} | ${functionName}() | required argument 'fields' is not an array`,
                        thrownByFunction: `${that._className} v${that._version} | ${functionName}()`,
                        thrownByFunctionArgs: args
                    }));
                }else{
                    let url = `${args.protocol}://${args.server}:${args.port}${(that.hasAttribute('proxyPath'))?that.proxyPath:''}/api/arsys/v1/entry/${encodeURIComponent(args.schema)}/${args.ticket}/?fields=values(${args.fields.join(",")})`;
                    /*
                        associations:
                            * getAssociations <bool> || array
                              if null or boolean false: do nothing
                              if boolean true: get a list of all associations   url += `,assoc`
                              if array: get associationNames listed             url += `,assoc(getAssociations.join(','))`

                            * expandAssociations <bool>
                              if true and getAssociations is an array, expand (get fieldValues for) the associations listed in getAssociations
                              url += `&expand=assoc(getAssociations.join(','))`
                    */
                    if (args.hasOwnProperty('getAssociations')){
                        if (args.getAssociations === true){
                            url += `,assoc`;
                        }else if (args.getAssociations instanceof Array){
                            let as = [];
                            as = args.getAssociations;
                            if (args.hasOwnProperty('expandAssociations') && (args.expandAssociations === true)){
                                url += `&expand=assoc(${as.join(',')})`;
                            }else{
                                url += `,assoc(${as.join(',')})`;
                            }
                        }
                    }
                    if (that.debug){ console.log(`${that._className} v${that._version} | ${functionName}() | ${url}`); }
                    let abort = false;
                    that.apiFetch({
                        endpoint:           url,
                        method:             'GET',
                        expectHtmlStatus:   200,
                        headers: {
                            "Authorization":    `AR-JWT ${that.token}`,
                            "Content-Type":     "application/x-www-form-urlencoded",
                            "Cache-Control":    "no-cache"
                        }
                    }).catch(function(error){
                        abort = true;
                        error.message = `${that._className} v${that._version} | ${functionName}() | ${error}`;
                        error.thrownByFunction = `${that._className} v${that._version} | ${functionName}() -> apiFetch()`;
                        boot(error);
                    }).then(function(response){ if (! abort){
                        let parseAbort = false;
                        response.json().catch(function(error){
                            parseAbort = true;
                            boot(new RemedyRestAPIException({
                                messageType: 'non-ars',
                                message: `${that._className} v${that._version} | ${functionName}() | response json parse error: ${error}`,
                                thrownByFunction: `${that._className} v${that._version} | ${functionName}()`,
                                thrownByFunctionArgs: args
                            }));
                        }).then(function(data){
                            if (args.fetchAttachments){
                                let pk = [];
                                Object.keys(data.values).forEach(function(field){
                                    if (that.isNotNull(data.values[field])){
                                        if ((data.values[field] instanceof Object) && data.values[field].hasOwnProperty('name') && data.values[field].hasOwnProperty('sizeBytes')){
                                            if (that.debug){ console.log(`${that._className} v${that._version} | ${functionName}() | fetching attachment from field: ${field} with size: ${data.values[field].sizeBytes} and filename: ${data.values[field].name}`); }
                                            pk.push(new Promise(function(t, b){
                                                let a = false;
                                                that.getAttachment({
                                                    schema:     args.schema,
                                                    ticket:     args.ticket,
                                                    fieldName:  field
                                                }).catch(function(error){
                                                    a = true;
                                                    error.message = `${that._className} v${that._version} | ${functionName}() -> getAttachment(${field}) | ${error}`;
                                                    error.thrownByFunction = `${that._className} v${that._version} | ${functionName}() -> getAttachment()`;
                                                    b(error);
                                                }).then(function(dta){
                                                    data.values[field].data = dta;
                                                    t(true);
                                                });
                                            }));
                                        }
                                    }
                                });
                                let mbort = false;
                                Promise.all(pk).catch(function(error){
                                    mbort = true;
                                    boot(error);
                                }).then(function(){ if (! mbort){
                                    toot(data);
                                }});
                            }else{
                                toot(data);
                            }
                        });
                    }});
                }
            }
        }
    }));
}




/*
    createTicket()
*/
createTicket(p){
    let that = this;
    let functionName = 'createTicket';

    // merge function args to object server connect properties
    let args = Object.assign({
        protocol:           that.protocol,
        server:             that.server,
        port:               that.port

    }, (p instanceof Object)?p:{});

    return(new Promise(function(toot, boot){

        // bounce if not authenticated
        if (! that.isAuthenticated){
            boot(new RemedyRestAPIException({
                messageType: 'non-ars',
                message: `${that._className} v${that._version} | ${functionName}() | api handle is not authenticated`,
                thrownByFunction: `${that._className} v${that._version} | ${functionName}()`,
                thrownByFunctionArgs: args
            }));
        }else{

            // bounce for missing args
            let missingArgs = [];
            ['protocol', 'server', 'port', 'schema', 'fields'].forEach(function(arg){
                if (! (args.hasOwnProperty(arg) && that.isNotNull(args[arg]))){ missingArgs.push(arg); }
            });
            if (missingArgs.length > 0){
                boot(new RemedyRestAPIException({
                    messageType: 'non-ars',
                    message: `${that._className} v${that._version} | ${functionName}() | missing args: ${missingArgs.join(", ")}`,
                    thrownByFunction: `${that._className} v${that._version} | ${functionName}()`,
                    thrownByFunctionArgs: args
                }));
            }else{
                // bounce for fields not being an object
                if (! (args.hasOwnProperty('fields') && (args.fields instanceof Object))){
                    boot(new RemedyRestAPIException({
                        messageType: 'non-ars',
                        message: `${that._className} v${that._version} | ${functionName}() | required argument 'fields' is not an object`,
                        thrownByFunction: `${that._className} v${that._version} | ${functionName}()`,
                        thrownByFunctionArgs: args
                    }));
                }else{
                    let url = `${args.protocol}://${args.server}:${args.port}${(that.hasAttribute('proxyPath'))?that.proxyPath:''}/api/arsys/v1/entry/${encodeURIComponent(args.schema)}`;
                    if (that.debug){ console.log(`${that._className} v${that._version} | ${functionName}() | ${url}`); }
                    let fetchArgs = {
                        endpoint:           url,
                        method:             'POST',
                        expectHtmlStatus:   201,
                        body:            { values: args.fields },
                        encodeBody:      true,
                        headers:            {
                            "Authorization":    `AR-JWT ${that.token}`,
                            "Content-Type":     "application/json",
                            "Cache-Control":    "no-cache"
                        }
                    };
                    /*
                        attachments
                    */
                    if (args.hasOwnProperty('attachments') && (args.attachments instanceof Object)){
                        let separator = that.getGUID().replaceAll('-', '');
                        let fieldsJSON = JSON.stringify(fetchArgs.body);
                        fetchArgs.body =
`
--${separator}
Content-Disposition: form-data; name="entry"
Content-Type: application/json; charset=UTF-8
Content-Transfer-Encoding: 8bit

${fieldsJSON}

`;

                        Object.keys(args.attachments).forEach(function(fileFieldName){
                            let file = args.attachments[fileFieldName];
                            let encoding = (file.hasOwnProperty('encoding'))?file.encoding:'binary';
                            fetchArgs.body +=
`
--${separator}
Content-Disposition: form-data; name="attach-${fileFieldName}"; filename="attach-${file.name}"
Content-Type: application/octet-stream
Content-Transfer-Encoding: ${encoding}

${file.content}
--${separator}--
`;
                        });

                        fetchArgs.encodeBody = false;
                        fetchArgs.headers["Content-Type"] = `multipart/form-data;boundary=${separator}`;
                    } // end attachment handling

                    let abort = false;



                    that.apiFetch(fetchArgs).catch(function(error){
                        abort = true;
                        error.message = `${that._className} v${that._version} | ${functionName}() | ${error}`;
                        error.thrownByFunction = `${that._className} v${that._version} | ${functionName}() -> apiFetch()`;
                        boot(error);
                    }).then(function(response){
                        if (! abort){
                            if (that.isNotNull(response.headers.get('location'))){
                                let tmp = response.headers.get('location').split('/');
                                toot({
                                    url: response.headers.get('location'),
                                    entryId: tmp[(tmp.length -1)]
                                });
                            }else{
                                // can't get ticket number?
                                boot(new RemedyRestAPIException({
                                    messageType: 'non-ars',
                                    message: `${that._className} v${that._version} | ${functionName}() | cannot parse server response for entryId`,
                                    thrownByFunction: `${that._className} v${that._version} | ${functionName}()`,
                                    thrownByFunctionArgs: args
                                }));
                            }
                        }
                    });
                }
            }
        }
    }));
}




/*
    modifyTicket()
*/
modifyTicket(p){

    let that = this;
    let functionName = 'modifyTicket';

    // merge function args to object server connect properties
    let args = Object.assign({
        protocol:           that.protocol,
        server:             that.server,
        port:               that.port

    }, (p instanceof Object)?p:{});

    return(new Promise(function(toot, boot){

        // bounce if not authenticated
        if (! that.isAuthenticated){
            boot(new RemedyRestAPIException({
                messageType: 'non-ars',
                message: `${that._className} v${that._version} | ${functionName}() | api handle is not authenticated`,
                thrownByFunction: `${that._className} v${that._version} | ${functionName}()`,
                thrownByFunctionArgs: args
            }));
        }else{

            // bounce for missing args
            let missingArgs = [];
            ['protocol', 'server', 'port', 'schema', 'fields', 'ticket'].forEach(function(arg){
                if (! (args.hasOwnProperty(arg) && that.isNotNull(args[arg]))){ missingArgs.push(arg); }
            });
            if (missingArgs.length > 0){
                boot(new RemedyRestAPIException({
                    messageType: 'non-ars',
                    message: `${that._className} v${that._version} | ${functionName}() | missing args: ${missingArgs.join(", ")}`,
                    thrownByFunction: `${that._className} v${that._version} | ${functionName}()`,
                    thrownByFunctionArgs: args
                }));
            }else{
                // bounce for fields not being an object
                if (! (args.hasOwnProperty('fields') && (args.fields instanceof Object))){
                    boot(new RemedyRestAPIException({
                        messageType: 'non-ars',
                        message: `${that._className} v${that._version} | ${functionName}() | required argument 'fields' is not an object`,
                        thrownByFunction: `${that._className} v${that._version} | ${functionName}()`,
                        thrownByFunctionArgs: args
                    }));
                }else{

                    // endpoint url
                    let url = `${args.protocol}://${args.server}:${args.port}${(that.hasAttribute('proxyPath'))?that.proxyPath:''}/api/arsys/v1/entry/${encodeURIComponent(args.schema)}/${args.ticket}`;
                    if (that.debug){ console.log(`${that._className} v${that._version} | ${functionName}() | ${url}`); }
                    let fetchArgs = {
                        endpoint:           url,
                        method:             'PUT',
                        expectHtmlStatus:   204,
                        body:            { values: args.fields },
                        encodeBody:      true,
                        headers:            {
                            "Authorization":    `AR-JWT ${that.token}`,
                            "Content-Type":     "application/json",
                            "Cache-Control":    "no-cache"
                        }
                    };
                    /*
                        attachments
                    */
                    if (args.hasOwnProperty('attachments') && (args.attachments instanceof Object)){
                        let separator = that.getGUID().replaceAll('-', '');
                        let fieldsJSON = JSON.stringify(fetchArgs.body);
                        fetchArgs.body =
`
--${separator}
Content-Disposition: form-data; name="entry"
Content-Type: application/json; charset=UTF-8
Content-Transfer-Encoding: 8bit

${fieldsJSON}

`;

                        Object.keys(args.attachments).forEach(function(fileFieldName){
                            let file = args.attachments[fileFieldName];
                            let encoding = (file.hasOwnProperty('encoding'))?file.encoding:'binary';
                            fetchArgs.body +=
`
--${separator}
Content-Disposition: form-data; name="attach-${fileFieldName}"; filename="attach-${file.name}"
Content-Type: application/octet-stream
Content-Transfer-Encoding: ${encoding}

${file.content}
--${separator}--
`;
                        });

                        fetchArgs.encodeBody = false;
                        fetchArgs.headers["Content-Type"] = `multipart/form-data;boundary=${separator}`;
                    } // end attachment handling

                    let abort = false;



                    that.apiFetch(fetchArgs).catch(function(error){
                        abort = true;
                        error.message = `${that._className} v${that._version} | ${functionName}() | ${error}`;
                        error.thrownByFunction = `${that._className} v${that._version} | ${functionName}() -> apiFetch()`;
                        boot(error);
                    }).then(function(response){
                        if (! abort){ toot(true); }
                    });
                }
            }
        }
    }));
}




/*
    deleteTicket()
*/
deleteTicket(p){

    let that = this;
    let functionName = 'deleteTicket';

    // merge function args to object server connect properties
    let args = Object.assign({
        protocol:           that.protocol,
        server:             that.server,
        port:               that.port

    }, (p instanceof Object)?p:{});

    return(new Promise(function(toot, boot){

        // bounce if not authenticated
        if (! that.isAuthenticated){
            boot(new RemedyRestAPIException({
                messageType: 'non-ars',
                message: `${that._className} v${that._version} | ${functionName}() | api handle is not authenticated`,
                thrownByFunction: `${that._className} v${that._version} | ${functionName}()`,
                thrownByFunctionArgs: args
            }));
        }else{

            // bounce for missing args
            let missingArgs = [];
            ['protocol', 'server', 'port', 'schema', 'ticket'].forEach(function(arg){
                if (! (args.hasOwnProperty(arg) && that.isNotNull(args[arg]))){ missingArgs.push(arg); }
            });
            if (missingArgs.length > 0){
                boot(new RemedyRestAPIException({
                    messageType: 'non-ars',
                    message: `${that._className} v${that._version} | ${functionName}() | missing args: ${missingArgs.join(", ")}`,
                    thrownByFunction: `${that._className} v${that._version} | ${functionName}()`,
                    thrownByFunctionArgs: args
                }));
            }else{

                let url = `${args.protocol}://${args.server}:${args.port}${(that.hasAttribute('proxyPath'))?that.proxyPath:''}/api/arsys/v1/entry/${encodeURIComponent(args.schema)}/${args.ticket}`;
                if (that.debug){ console.log(`${that._className} v${that._version} | ${functionName}() | ${url}`); }
                let abort = false;
                that.apiFetch({
                    endpoint:         url,
                    method:           'DELETE',
                    expectHtmlStatus: 204,
                    headers: {
                        "Authorization":    `AR-JWT ${that.token}`,
                        "Content-Type":     "application/json",
                        "Cache-Control":    "no-cache"
                    }
                }).catch(function(error){
                    abort = false;
                    error.message = `${that._className} v${that._version} | ${functionName}() | ${error}`;
                    error.thrownByFunction = `${that._className} v${that._version} | ${functionName}() -> apiFetch()`;
                    boot(error);
                }).then(function(){
                    if (! abort){ toot(args.ticket); }
                });
            }
        }
    }));
}




/*
    mergeData()
*/
mergeData(p){

    let that = this;
    let functionName = 'mergeData';

    // merge function args to object server connect properties
    let args = Object.assign({
        protocol:           that.protocol,
        server:             that.server,
        port:               that.port

    }, (p instanceof Object)?p:{});

    return(new Promise(function(toot, boot){

        // bounce if not authenticated
        if (! that.isAuthenticated){
            boot(new RemedyRestAPIException({
                messageType: 'non-ars',
                message: `${that._className} v${that._version} | ${functionName}() | api handle is not authenticated`,
                thrownByFunction: `${that._className} v${that._version} | ${functionName}()`,
                thrownByFunctionArgs: args
            }));
        }else{

            // bounce for missing args
            let missingArgs = [];
            ['protocol', 'server', 'port', 'schema', 'fields'].forEach(function(arg){
                if (! (args.hasOwnProperty(arg) && that.isNotNull(args[arg]))){ missingArgs.push(arg); }
            });
            if (missingArgs.length > 0){
                boot(new RemedyRestAPIException({
                    messageType: 'non-ars',
                    message: `${that._className} v${that._version} | ${functionName}() | missing args: ${missingArgs.join(", ")}`,
                    thrownByFunction: `${that._className} v${that._version} | ${functionName}()`,
                    thrownByFunctionArgs: args
                }));
            }else{
                // bounce for fields not being an object
                if (! (args.hasOwnProperty('fields') && (args.fields instanceof Object))){
                    boot(new RemedyRestAPIException({
                        messageType: 'non-ars',
                        message: `${that._className} v${that._version} | ${functionName}() | required argument 'fields' is not an object`,
                        thrownByFunction: `${that._className} v${that._version} | ${functionName}()`,
                        thrownByFunctionArgs: args
                    }));
                }else{
                    // validate handleDuplicateEntryId (default "error")
                    let mergeTypeDecoder = {
                        error:          "DUP_ERROR",
                        create:         "DUP_NEW_ID",
                        overwrite:      "DUP_OVERWRITE",
                        merge:          "DUP_MERGE",
                        alwaysCreate:   "GEN_NEW_ID"
                    };
                    if (!((args.hasOwnProperty('handleDuplicateEntryId')) && that.isNotNull(args.handleDuplicateEntryId) && (Object.keys(mergeTypeDecoder).indexOf(args.handleDuplicateEntryId) >= 0))){
                        p.handleDuplicateEntryId = 'error';
                    }

                    // validate multimatchOption (default "error")
                    let multimatchOptionDecoder = {
                        error:              0,
                        useFirstMatching:   1
                    };
                    if (!((args.hasOwnProperty('multimatchOption')) && that.isNotNull(args.multimatchOption) && (Object.keys(multimatchOptionDecoder).indexOf(args.multimatchOption) >= 0))){
                        args.multimatchOption = 'error';
                    }

                    // she.done.already.done.had.herses
                    let url = `${args.protocol}://${args.server}:${args.port}${(that.hasAttribute('proxyPath'))?that.proxyPath:''}/api/arsys/v1/mergeEntry/${encodeURIComponent(args.schema)}`;
                    if (that.debug){ console.log(`${that._className} v${that._version} | ${functionName}() | ${url}`); }

                    let body = {
                        values:         args.fields,
                        mergeOptions:   {
                            mergeType:              mergeTypeDecoder[args.handleDuplicateEntryId],
                            multimatchOption:       multimatchOptionDecoder[args.multimatchOption],
                            ignorePatterns:         (args.hasOwnProperty('ignorePatterns') && args.ignorePatterns === true),
                            ignoreRequired:         (args.hasOwnProperty('ignoreRequired') && args.ignoreRequired === true),
                            workflowEnabled:        (! (args.hasOwnProperty('workflowEnabled') && args.workflowEnabled === true)),
                            associationsEnabled:    (! (args.hasOwnProperty('associationsEnabled') && args.associationsEnabled === true))
                        }
                    };
                    if (args.hasOwnProperty('QBE') && (that.isNotNull(args.QBE))){ body.qualification = args.QBE; }

                    let abort = false;
                    that.apiFetch({
                        endpoint:           url,
                        method:             'POST',
                        expectHtmlStatus:   [201, 204],
                        headers: {
                            "Authorization":    `AR-JWT ${that.token}`,
                            "Content-Type":     "application/json",
                            "Cache-Control":    "no-cache"
                        },
                        body: body,
                        encodeBody: true
                    }).catch(function(error){
                        abort = true;
                        error.message = `${that._className} v${that._version} | ${functionName}() | ${error}`;
                        error.thrownByFunction = `${that._className} v${that._version} | ${functionName}() -> apiFetch()`;
                        boot(error);
                    }).then(function(response){
                        if (! abort){
                            if (that.isNotNull(response.headers.get('location'))){
                                let tmp = response.headers.get('location').split('/');
                                toot({
                                    url: response.headers.get('location'),
                                    entryId: tmp[(tmp.length -1)]
                                });
                            }else{
                                // can't get ticket number?
                                boot(new RemedyRestAPIException({
                                    messageType: 'non-ars',
                                    message: `${that._className} v${that._version} | ${functionName}() | cannot parse server response for entryId`,
                                    thrownByFunction: `${that._className} v${that._version} | ${functionName}()`,
                                    thrownByFunctionArgs: args
                                }));
                            }
                        }
                    });
                }
            }
        }
    }));
} // end mergeData




/*
    getFormOptions()
*/
getFormOptions(p){

    let that = this;
    let functionName = 'getFormOptions';

    // merge function args to object server connect properties
    let args = Object.assign({
        protocol:           that.protocol,
        server:             that.server,
        port:               that.port

    }, (p instanceof Object)?p:{});

    return(new Promise(function(toot, boot){

        // bounce if not authenticated
        if (! that.isAuthenticated){
            boot(new RemedyRestAPIException({
                messageType: 'non-ars',
                message: `${that._className} v${that._version} | ${functionName}() | api handle is not authenticated`,
                thrownByFunction: `${that._className} v${that._version} | ${functionName}()`,
                thrownByFunctionArgs: args
            }));
        }else{

            // bounce for missing args
            let missingArgs = [];
            ['protocol', 'server', 'port', 'schema'].forEach(function(arg){
                if (! (args.hasOwnProperty(arg) && that.isNotNull(args[arg]))){ missingArgs.push(arg); }
            });
            if (missingArgs.length > 0){
                boot(new RemedyRestAPIException({
                    messageType: 'non-ars',
                    message: `${that._className} v${that._version} | ${functionName}() | missing args: ${missingArgs.join(", ")}`,
                    thrownByFunction: `${that._className} v${that._version} | ${functionName}()`,
                    thrownByFunctionArgs: args
                }));
            }else{
                let url = `${args.protocol}://${args.server}:${args.port}${(that.hasAttribute('proxyPath'))?that.proxyPath:''}/api/arsys/v1.0/entry/${encodeURIComponent(args.schema)}`;
                if (that.debug){ console.log(`${that._className} v${that._version} | ${functionName}() | ${url}`); }
                let abort = false;

                that.apiFetch({
                    endpoint:         url,
                    method:           'OPTIONS',
                    expectHtmlStatus: 200,
                    headers:  {
                        "Authorization":    `AR-JWT ${that.token}`,
                        "Content-Type":     "application/json",
                        "Cache-Control":    "no-cache"
                    }
                }).catch(function(error){
                    abort = true;
                    error.message = `${that._className} v${that._version} | ${functionName}() | ${error}`;
                    error.thrownByFunction = `${that._className} v${that._version} | ${functionName}() -> apiFetch()`;
                    boot(error);
                }).then(function(response){
                    let parseAbort = false;
                    response.json().catch(function(error){
                        parseAbort = true;
                        boot(new RemedyRestAPIException({
                            messageType: 'non-ars',
                            message: `${that._className} v${that._version} | ${functionName}() | response parse error: ${error}`,
                            thrownByFunction: `${that._className} v${that._version} | ${functionName}() -> apiFetch() -> response.json()`,
                            thrownByFunctionArgs: args
                        }));
                    }).then(function(responseData){
                        if (! parseAbort){
                            toot(responseData);
                        }
                    });
                });
            }
        }
    }));

}




/*
    getMenu()
*/
getMenu(p){

    let that = this;
    let functionName = 'getMenu';

    // merge function args to object server connect properties
    let args = Object.assign({
        protocol:           that.protocol,
        server:             that.server,
        port:               that.port

    }, (p instanceof Object)?p:{});

    return(new Promise(function(toot, boot){

        // bounce if not authenticated
        if (! that.isAuthenticated){
            boot(new RemedyRestAPIException({
                messageType: 'non-ars',
                message: `${that._className} v${that._version} | ${functionName}() | api handle is not authenticated`,
                thrownByFunction: `${that._className} v${that._version} | ${functionName}()`,
                thrownByFunctionArgs: args
            }));
        }else{

            // bounce for missing args
            let missingArgs = [];
            ['protocol', 'server', 'port', 'name'].forEach(function(arg){
                if (! (args.hasOwnProperty(arg) && that.isNotNull(args[arg]))){ missingArgs.push(arg); }
            });
            if (missingArgs.length > 0){
                boot(new RemedyRestAPIException({
                    messageType: 'non-ars',
                    message: `${that._className} v${that._version} | ${functionName}() | missing args: ${missingArgs.join(", ")}`,
                    thrownByFunction: `${that._className} v${that._version} | ${functionName}()`,
                    thrownByFunctionArgs: args
                }));
            }else{
                let url = `${args.protocol}://${args.server}:${args.port}${(that.hasAttribute('proxyPath'))?that.proxyPath:''}/api/arsys/v1.0/menu/${encodeURIComponent(args.name)}`;
                if (that.debug){ console.log(`${that._className} v${that._version} | ${functionName}() | ${url}`); }
                let abort = false;
                that.apiFetch({
                    endpoint:         url,
                    method:           'GET',
                    expectHtmlStatus: 200,
                    headers: {
                        "Authorization":    `AR-JWT ${that.token}`,
                        "Content-Type":     "application/json",
                        "Cache-Control":    "no-cache"
                    }
                }).catch(function(error){
                    abort = true;
                    error.message = `${that._className} v${that._version} | ${functionName}() | ${error}`;
                    error.thrownByFunction = `${that._className} v${that._version} | ${functionName}() -> apiFetch()`;
                    boot(error);
                }).then(function(response){
                    let parseAbort = false;
                    response.json().catch(function(error){
                        parseAbort = true;
                        boot(new RemedyRestAPIException({
                            messageType: 'non-ars',
                            message: `${that._className} v${that._version} | ${functionName}() | response parse error: ${error}`,
                            thrownByFunction: `${that._className} v${that._version} | ${functionName}() -> apiFetch() -> response.json()`,
                            thrownByFunctionArgs: args
                        }));
                    }).then(function(responseData){
                        if (! parseAbort){
                            toot(responseData);
                        }
                    });
                });
            }
        }
    }));
}




/*
    getMenuValues()
*/
getMenuValues(p){
    let that = this;
    let functionName = 'getMenuValues';


    return(new Promise(function(toot, boot){

        // bounce if not authenticated
        if (! that.isAuthenticated){
            boot(new RemedyRestAPIException({
                messageType: 'non-ars',
                message: `${that._className} v${that._version} | ${functionName}() | api handle is not authenticated`,
                thrownByFunction: `${that._className} v${that._version} | ${functionName}()`,
                thrownByFunctionArgs: p
            }));
        }else{

            // bounce for missing args
            let missingArgs = [];
            ['name'].forEach(function(arg){
                if (! (p.hasOwnProperty(arg) && that.isNotNull(p[arg]))){ missingArgs.push(arg); }
            });
            if (missingArgs.length > 0){
                boot(new RemedyRestAPIException({
                    messageType: 'non-ars',
                    message: `${that._className} v${that._version} | ${functionName}() | missing args: ${missingArgs.join(", ")}`,
                    thrownByFunction: `${that._className} v${that._version} | ${functionName}()`,
                    thrownByFunctionArgs: p
                }));
            }else{
                let url = `${that.protocol}://${that.server}:${that.port}${(that.hasAttribute('proxyPath'))?that.proxyPath:''}/api/arsys/v1.0/menu/expand`;
                if (that.debug){ console.log(`${that._className} v${that._version} | ${functionName}() | ${url}`); }
                let abort = false;
                that.apiFetch({
                    endpoint:         url,
                    method:           'POST',
                    expectHtmlStatus: 200,
                    body:             p,
                    encodeBody:       true,
                    headers: {
                        "Authorization":    `AR-JWT ${that.token}`,
                        "Content-Type":     "application/json",
                        "Cache-Control":    "no-cache"
                    }
                }).catch(function(error){
                    abort = true;
                    error.message = `${that._className} v${that._version} | ${functionName}() | ${error}`;
                    error.thrownByFunction = `${that._className} v${that._version} | ${functionName}() -> apiFetch()`;
                    boot(error);
                }).then(function(response){
                    if (! abort){
                        let parseAbort = false;
                        response.json().catch(function(error){
                            parseAbort = true;
                            boot(new RemedyRestAPIException({
                                messageType: 'non-ars',
                                message: `${that._className} v${that._version} | ${functionName}() | response parse error: ${error}`,
                                thrownByFunction: `${that._className} v${that._version} | ${functionName}() -> apiFetch() -> response.json()`,
                                thrownByFunctionArgs: args
                            }));
                        }).then(function(responseData){
                            if (! parseAbort){
                                toot(responseData);
                            }
                        });
                    }
                });
            }
        }
    }));
}




/*
    getFormFields()
*/
getFormFields(p){
    let that = this;
    let functionName = 'getFormFields';

    // merge function args to object server connect properties
    let args = Object.assign({
        protocol:           that.protocol,
        server:             that.server,
        port:               that.port,
        fetchMenus:         false
    }, (p instanceof Object)?p:{});

    return(new Promise(function(toot, boot){

        // bounce if not authenticated
        if (! that.isAuthenticated){
            boot(new RemedyRestAPIException({
                messageType: 'non-ars',
                message: `${that._className} v${that._version} | ${functionName}() | api handle is not authenticated`,
                thrownByFunction: `${that._className} v${that._version} | ${functionName}()`,
                thrownByFunctionArgs: args
            }));
        }else{

            // bounce for missing args
            let missingArgs = [];
            ['protocol', 'server', 'port', 'schema'].forEach(function(arg){
                if (! (args.hasOwnProperty(arg) && that.isNotNull(args[arg]))){ missingArgs.push(arg); }
            });
            if (missingArgs.length > 0){
                boot(new RemedyRestAPIException({
                    messageType: 'non-ars',
                    message: `${that._className} v${that._version} | ${functionName}() | missing args: ${missingArgs.join(", ")}`,
                    thrownByFunction: `${that._className} v${that._version} | ${functionName}()`,
                    thrownByFunctionArgs: args
                }));
            }else{
                let url = `${args.protocol}://${args.server}:${args.port}${(that.hasAttribute('proxyPath'))?that.proxyPath:''}/api/arsys/v1.0/fields/${encodeURIComponent(args.schema)}`;
                if (that.debug){ console.log(`${that._className} v${that._version} | ${functionName}() | ${url}`); }
                let abort = false;
                that.apiFetch({
                    endpoint:         url,
                    method:           'GET',
                    expectHtmlStatus: 200,
                    headers: {
                        "Authorization":    `AR-JWT ${that.token}`,
                        "Content-Type":     "application/json",
                        "Cache-Control":    "no-cache"
                    }
                }).catch(function(error){
                    abort = true;
                    error.message = `${that._className} v${that._version} | ${functionName}() | ${error}`;
                    error.thrownByFunction = `${that._className} v${that._version} | ${functionName}() -> apiFetch()`;
                    boot(error);
                }).then(function(response){
                    if (! abort){
                        let parseAbort = false;
                        response.json().catch(function(error){
                            parseAbort = true;
                            boot(new RemedyRestAPIException({
                                messageType: 'non-ars',
                                message: `${that._className} v${that._version} | ${functionName}() | response parse error: ${error}`,
                                thrownByFunction: `${that._className} v${that._version} | ${functionName}() -> apiFetch() -> response.json()`,
                                thrownByFunctionArgs: args
                            }));
                        }).then(function(responseData){
                            if (! parseAbort){
                                let formDefinition = {
                                    idIndex: {},
                                    nameIndex: {},
                                    menus: {}
                                };
                                responseData.forEach(function(field){
                                    formDefinition.idIndex[field.id] = field;
                                    formDefinition.nameIndex[field.name] = field;
                                });

                                // handle fetch menus
                                if (args.fetchMenus){
                                    let menusToGet = {};
                                    responseData.forEach(function(fieldDef){
                                        if (
                                            (fieldDef instanceof Object) &&
                                            fieldDef.hasOwnProperty('limit') &&
                                            (fieldDef.limit instanceof Object) &&
                                            (fieldDef.limit.hasOwnProperty('char_menu')) &&
                                            (that.isNotNull(fieldDef.limit.char_menu))
                                        ){
                                            menusToGet[fieldDef.limit.char_menu] = true;
                                        }
                                    });
                                    let pk = [];
                                    let menuErrors = [];
                                    Object.keys(menusToGet).forEach(function(menuName){
                                        pk.push(new Promise(function(toot, boot){
                                            let abrt = false;
                                            that.getMenu({name: menuName}).catch(function(error){
                                                abrt = true;
                                                menuErrors.push(error);
                                                if (that.debug){ console.log(`${that._className} v${that._version}| ${functionName}()/fetchMenus(${menuName}) | error: ${error}`); }
                                                boot(false);
                                            }).then(function(menuDef){
                                                if (! abrt){
                                                    formDefinition.menus[menuName] = menuDef;
                                                    toot(true);
                                                }
                                            })
                                        }));
                                    });
                                    let mbort = false;
                                    Promise.all(pk).catch(function(error){
                                        mbort = true;
                                        boot(new RemedyRestAPIException({
                                            messageType: 'non-ars',
                                            message: `${that._className} v${that._version} | ${functionName}() | failed to retrieve menus (multiple errors)`,
                                            thrownByFunction: `${that._className} v${that._version} | ${functionName}() -> fetchMenus`,
                                            thrownByFunctionArgs: args,
                                            errors: menuErrors
                                        }));
                                    }).then(function(){
                                        if (Object.keys(formDefinition.menus) == 0){ delete(formDefinition.menus); }
                                        toot(formDefinition);
                                    })
                                }else{
                                    toot(formDefinition);
                                }
                            }
                        });
                    }
                });
            }
        }
    }));
}




/*
    getRelatedFormsAndMenus()
*/
getRelatedFormsAndMenus(p){
    let that = this;
    let functionName = 'getRelatedFormsAndMenus';

    // merge function args to object server connect properties
    let args = Object.assign({
        protocol:           that.protocol,
        server:             that.server,
        port:               that.port,
        fetchMenus:         false
    }, (p instanceof Object)?p:{});

    return(new Promise(function(toot, boot){

        // bounce if not authenticated
        if (! that.isAuthenticated){
            boot(new RemedyRestAPIException({
                messageType: 'non-ars',
                message: `${that._className} v${that._version} | ${functionName}() | api handle is not authenticated`,
                thrownByFunction: `${that._className} v${that._version} | ${functionName}()`,
                thrownByFunctionArgs: args
            }));
        }else{

            // bounce for missing args
            let missingArgs = [];
            ['schema'].forEach(function(arg){
                if (! (args.hasOwnProperty(arg) && that.isNotNull(args[arg]))){ missingArgs.push(arg); }
            });
            if (missingArgs.length > 0){
                boot(new RemedyRestAPIException({
                    messageType: 'non-ars',
                    message: `${that._className} v${that._version} | ${functionName}() | missing args: ${missingArgs.join(", ")}`,
                    thrownByFunction: `${that._className} v${that._version} | ${functionName}()`,
                    thrownByFunctionArgs: args
                }));
            }else{

                // recursively get forms
                let abort = false;
                let out = { forms: {}, menus: {} };
                that.getFormFields({schema: args.schema, fetchMenus: true}).catch(function(error){
                    abort = true;
                    error.message = `${functionName}(${p.schema}) | ${error.message}`;
                    boot(error);
                }).then(function(formDefinition){
                    if (! abort){
                        // insert the given form & menus into the return datastructure
                        if (formDefinition.menus instanceof Object){
                            Object.keys(formDefinition.menus).forEach(function(menuName){
                                out.menus[menuName] = formDefinition.menus[menuName]
                            });
                            delete(formDefinition.menus);
                        }
                        out.forms[args.schema] = formDefinition;

                        // get a distinct list of referenced forms
                        let formsToGet = {};
                        Object.keys(out.forms[args.schema].idIndex).forEach(function(fieldID){
                            let fieldDef = out.forms[args.schema].idIndex[fieldID];
                            if (
                                (fieldDef instanceof Object) &&
                                fieldDef.hasOwnProperty('datatype') &&
                                (fieldDef.datatype == 'TABLE') &&
                                (fieldDef.hasOwnProperty('limit')) &&
                                (fieldDef.limit instanceof Object) &&
                                (fieldDef.limit.hasOwnProperty('source_form')) &&
                                that.isNotNull(fieldDef.limit.source_form) &&
                                (! (out.forms.hasOwnProperty(fieldDef.limit.source_form)))
                            ){
                                // we found a form to get
                                formsToGet[fieldDef.limit.source_form] = true;
                            }
                        });

                        // await recursion
                        let pk = [];
                        let pkErrors = [];
                        Object.keys(formsToGet).forEach(function(formName){
                            pk.push(new Promise(function(t,b){
                                let abrt = false;
                                that.getRelatedFormsAndMenus({schema: formName}).catch(function(error){
                                    abrt = true;
                                    pkErrors.push(error);
                                    if (that.debug){ console.log(`${that._className} | getRelatedFormsAndMenus(${formName}) | error: ${error}`); }
                                    b(false);
                                }).then(function(recurseOut){
                                    if (! abrt){

                                        // merge recursion result with output
                                        ['menus', 'forms'].forEach(function(kind){
                                            if (recurseOut[kind] instanceof Object){
                                                Object.keys(recurseOut[kind]).forEach(function(thing){
                                                    out[kind][thing] = recurseOut[kind][thing];
                                                })
                                            }
                                        });
                                        t(true);
                                    }
                                })
                            }))
                        });
                        let pkAbort = false;
                        Promise.all(pk).catch(function(error){
                            pkAbort = true;
                            boot(new RemedyRestAPIException ({
                                messageType:            'non-ars',
                                message:                `recursion failed (multiple, see 'errors')`,
                                thrownByFunction:       'getRelatedFormsAndMenus',
                                thrownByFunctionArgs:   (typeof(p) !== 'undefined')?p:{},
                                errors:                 pkErrors
                            }));
                        }).then(function(){
                            if (! pkAbort){
                                toot(out);
                            }
                        });
                    } // end getFormFields abort check
                });
            }
        }
    }));
}




} // end remedyRestAPI class


// node hook
if ((typeof module !== 'undefined') && (module.exports)){
    module.exports = RemedyRestAPI;
}
