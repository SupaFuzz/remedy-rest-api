# remedy-rest-api

This is a javascript library for talking to [BMC's Remedy ARS REST API](https://docs.bmc.com/docs/ars91/en/bmc-remedy-ar-system-rest-api-overview-609071509.html).

The goal of this project is to zero a zero-dependency library that can work either in node.js or in a browser (for instance, to drop into an HTML template). Unfortunately, node.js does not support the [XMLHTTPRequest (XHR) API](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest), which is how browsers are able to perform asynchronous network operations (which is what talking to a REST service is). So in that respect, from the node.js side, this library is not truly dependency free as it is currently using [a forked version of the XmlHttpRequest npm package](https://github.com/ahicox/node-XMLHttpRequest). In any case ... that is the idea ... the library uses browser-standard XHR calls and we basically make a polyfill for node.js to support XHR.

### This Library is a Work in Progress

*to-do:* rewrite this in typescript.

**What Works** everything in the BMC ARS REST API as described in the documentation link above works, with the exception of these features:

* [Associations](https://docs.bmc.com/docs/ars1805/entry-formname-entryid-assoc-associationname-804716414.html)

* Creating and Updating Attachment fields

  The library can currently *retrieve* Attachments via getTicket(), query() and getAttachment(), however the library cannot presently *send* attachment data on createTicket(), modifyTicket() or mergeData(). The reason for this, is that the XHR API emulation I'm using doesn't support the new(ish) [FormData API](https://developer.mozilla.org/en-US/docs/Web/API/FormData). FormData appears to be the only legit way to send multipart/form-data encoded requests on the XHR API inside a browser (without resorting to hidden iFrames and other trickery). So yes, I could just bust out some node code and git-r-done, but that'd break browser compatibility. So ... what needs to happen next on this is to fix up the XHR emulation module to support FormData, *then* to hack browser-compatible XHR API calls into the library to send attachments. Which is why I'm sorta tying it off here ... I'll get back to this issue eventually. In the mean time, the rest of it works well enough and is useful enough to warrant release.

  NOTE TO SELF (6/27/18): [this may be what I'm looking for](https://github.com/pwnall/node-xhr2)

**Philosophy** The javascript ecosystem is in the midst of a [Cambrian Explosion](https://en.wikipedia.org/wiki/Cambrian_explosion) of features and libraries and programming approaches, putting it mildly. Working in this landscape forces one to adopt positions on certain topics. In my opinion, developing in javascript prior to ES6 was a complete nightmare, and as I'm doing this as a side project: basically I'm not messing with that noise. This library uses ES6 features liberally, and gives no hoots about breaking older/oddball browsers. These are some ES6 features you'll need to know about:

* [Promises](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises)
* [Async](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function)
* [Await](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/await)
* [Template Literals](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals)
* [Sane Class Syntax](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes)

**Contributing** Please feel free to! Email me at amy@hicox.com if you need to get in touch, or through the usual github channels.

**test.js is your friend** seriously, if you're hip, that's probably a quicker way to get started than reading this :-)

# Synopsis

```javascript

// include the library (node.js)
const Remedy = require('remedy-rest-api');

// create an object (does not return a promise)
try {
    let api = new Remedy({
        protocol:       'https',
        server:         'fakeserver.hicox.com',
        user:           'fakeAccount',
        pass:           'fakePass',
        timeout:        20000
    });
}catch(e){
    // do something with the error
}

// log into the ARServer (returns promise)
api.authenticate().then(function(self){
    // self contains a reference to api
}).catch(function(e)){
    // something failed, hannle yo bidness
}


/*
    you can also instantiate a new object
    and chain it to authenticate all in one
    go, and if you do it all inside an
    async function you can use await which
    will make you smile ...
*/
async function doSomeRemedyStuff(){

    // log into remedy and get ready to do stuff
    let api = await new Remedy({
        protocol:       'https',
        server:         'fakeserver.hicox.com',
        user:           'fakeAccount',
        pass:           'fakePass',
        timeout:        20000
    }).authenticate().catch(function(e){
        /*
            all errors returned by the library are of the ARSRestException class
            there are a lot of nifty features and I'll write more about this later
            however, the *.toString() attribute is quite handy ...
        */
        throw(`failed login!: ${e.toString()}`);
    });



    // create a ticket
    let newTicket = await api.createTicket({
        schema:     formName,
        fields:     {
            fieldNameOne:   "valueNumber1",
            fieldNameTwo:   "valueNumber2"
            ... etc ...
        }
    }).catch(function(e){
        throw(`failed createTicket! ${e.toString()}`);
    });
    console.log(`I made a new ticket! ${newTicket.entryId}`);



    // modify a ticket
    await api.modifyTicket({
        schema:     formName
        ticket:     entryId
        fields:     {
            fieldNameOne:   "a new value"
        }
    }).catch(function(e){
        throw(`failed modifyTicket: ${e.toString()}`)
    });



    // retrieve field values from a ticket when you know the ticket number
    let myTicketData = await api.getTicket({
        schema:     formName
        ticket:     entryId
        fields:     ['List', 'Of', 'FieldNames', 'to get', 'values for']
    }).catch(function(e){
        throw(`failed getTicket: ${e.toString()}`)
    });
    console.log("Here's what I got!")
    Object.keys(myTicketData.values).forEach(function(fieldName){
        console.log(`\t[${fieldName}]: ${myTicketData.values[fieldName]}`);
    });



    // query for tickets
    let myRecordList = await api.query({
        schema:     formName
        QBE:        `'Entry ID' != $NULL$`
        Fields:     ['List', 'Of', 'FieldNames', 'to get', 'values for']
    }).catch(function(e){
        throw(`query failed: ${e.toString()}`);
    });
    console.log("here's all the records I got!");
    myRecordList.entries.forEach(function(row, rowNumber){
        console.log(`[row number]: ${rowNumber}`);
        Object.keys(row.values).forEach(function(fieldName){
            console.log(`\t[${fieldName}]: ${row.values[fieldName]}`);
        });
    });


    // fetch an attachment
    let myAttachmentBinaryData = await api.getAttachment({
        schema:         formName
        entryId:        entryId
        fieldName:      attachmentFieldNameToFetch
    }).catch(function(e){
        throw(`failed to fetch attachment: ${e.toString()()}`)
    });

    // this is raw binary data. do your own thing. for instance writing it to a file
    await fsPromises.writeFile(`./tmp.jpg`, myAttachmentBinaryData);


    // delete a ticket
    let theDeletedTicketNumber = await api.deleteTicket({
        schema:     formName
        ticket:     entryId
    }).catch(function(e){
        throw(`failed to delete ticket: ${e.toString()}`);
    })
    console.log(`I just deleted: ${theDeletedTicketNumber}`);


    /*
        merge works!
        there are a lot of options.
        I'll write better documentation later
        test.js has a fairly readable test of everything
        might wanna check that out in the mean time
    */


    /*
        create a record on the given form with the given data
        if the 'Entry ID' (field #1 on the form) is contained
        in the given data, and there is already a record with
        that 'Entry ID', throw an error
    */
    let ticketId = await api.mergeData({
        schema:                 ticket,
        handleDuplicateEntryId: "error",
        fields: {
            'Entry ID':             'BOGUS-000000001',
            'Short Description':    'cowabunga dudes!'
            ...
        }    
    }).catch(function(e){
        throw(`mergeData failed: ${e.toString()}`);
    });
    console.log(`merged data onto ${ticketId.entryId}`);

}
```

# Object Hierarchy & Capturing Exceptions

Yeah ok, so this is an Object Oriented library. From reading forums and blog posts, you'd think that was completely passe and it's all functional these days. Perhaps it isn't cool or whatever, but it gets the job done and I can dig it. So what've we got here? Well it's an object hierarchy that looks more or less like this:

```
    noiceObjectCore             (provides a constructor model)
        noiceCoreUtility        (provides utility functions)
            ARSRestException    (models exceptions returned from the ARS REST API)
            ARSRestDispatcher   (handles dispatching XHR calls to the REST service)
            RemedyRestAPI       (the part you actually deal with)
```

For the most part, the **RemedyRestAPI** and the **ARSRestException** classes are where the action is.

Instantiating an object of the **RemedyRestAPI** class yields an object that can be used more or less as an "api handle" for a given remedy server, and user. All functions that talk to the server return a promise. Used in conjunction with async/await, this arrangement lends itself to what I like to call the [Fiddy Block](https://en.wikipedia.org/wiki/Get_Rich_or_Die_Tryin%27)

```javascript
    let cashMoney = await getRich().catch(function(e){
        throw(`I died tryin'! ${e}`);
    });
```

Basically everything in **RemedyRestAPI** lends itself quite well to wrapping (pun intended) in a "Fiddy Block". Every function in **RemedyRestAPI** will send an object of the **ARSRestException** class to the catch function ("e", in the example above). Objects of the **ARSRestException** class have the form:

```javascript
{
    httpStatus:             httpStatuCode
    httpResponseHeaders:    {
        headerName: headerValue
    }
    thrownByFunction:       // (optional) name of ARSRestAPI function that threw it
    thrownByFunctionArgs:   // (optional) a copy of the args sent to <thrownByFunction> (if speficied)
    arsErrorList:           [
        {
            messageType:            // ok | error | warning | fatal | bad status | non-ars,
            messageText:            // main error message ($ERRMSG$)
            messageAppendedText:    // addtional error message ($ERRAPPENDMSG$)
            messageNumber:          // error number (integer / $ERRNO$)
        },
        ...
    ]
}
```

You may note that 'arsErrorList' is an array. The AR Server may return an arbitrary number of error objects inside a single exception. Why? I don't know. BMC is like that, man. Maybe it contains something like a stack trace in some circumstances? I dunno. I DO know this though, that having multiple errors to deal with in the scenario of "I called this API function and it failed and I need to know the singular reason why" is less than useful.

To that end, the **ARSRestExcption** class has some attribute accessors that you can call to treat this as the singular exception it probably is:

* **.messageText**
* **.messageType**
* **.messageAppendedText**
* **.messageNumber**

Each of these attributes returns the corresponding attribute of the *first* entry in arsErrorList. There is also the 'message' attribute:

* **.message**

 in the case where the **ARSRestAPI** needs to return an exception that did not originate from the ARServer (hence has no entries in **arsErrorList**), this value can be set independently. If .message has been explicitly set, it will be returned, otherwise .messageText from the first entry in **arsErrorList** will be returned.

There is also this function:

* **.toString()**

  this overrides [Object.prototype.toString](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/toString) so that you can directly print a string representation of the error with the form:
  ```javascript
    `[http/${httpStatus} ${messageType} (${messageNumber})]: ${message} / ${messageAppendedText}`
  ```

And finally there is this special attribute:

* **.error**

 this returns an [Error Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error) with the message set to the output of **.toString()**

Ok, so that's how to capture exceptions from **ARSRestAPI**, let's have a detailed look at each of the functions.


# ARSRestAPI class

As mentioned above, objects of this class represent a connection to a specific **ARServer** as a specific user, against which various functions can be called.


## Instantiation

```javascript
try {
    let api = new RemedyRestAPI({
        protocol:   sslOrNot,       // http | https (default https)
        server:     hostname,
        port:       portNumber,    //(optionally specify a nonstandard port number)
        user:       userId,
        password:   password,
        debug:      bool,          // false | true (default false)
        timeout:    milliseconds   // (default 2 minutes)    
    });
}catch(e){
    throw(`failed to create object: ${e}`)
}
```

the constructor doesn't return a promise so you can't use a fiddy block, but of course, you can still die tryin' :-)

* **server**
  The hostname or IP address of the REST endpoint serving the Remedy API

* **protocol**
  One of "http" or "https", if not specified, defaults to "https"

* **port**
  You can optionally specify a non-standard port. If not specified, the standard for the given **protocol** is used (http: 80 / https: 443)

* **user**
  The user you wish to connect to Remedy as

* **password**
  The password for **user**

* **debug**
  boolean value, defaults to false if not specified. if specified, messages will be echoed via console.log()

* **timeout**
  the maximum number of milliseconds to wait for a response on an open socket. By default we set this to 2 minutes. Be aware that there's also a maximum transaction timeout configured somewhere on the ARServer, but you can set it up here how long to wait before giving up.


## authenticate()

```javascript

// on a previously created object inside an async function
await api.authenticate();

// on a previously created object outside an async function
api.authenticate().then(function(self){
    /*
        self contains another reference to api
        and you can do things in here after authenticating
    */
}).catch(function(e){
    throw(`failed to authenticate! ${e}`);
});

// inline with instantiation inside an async function (but it works with then/catch as well)
let api = await new RemedyRestAPI({
    server:     'fakeserver.hicox.com',
    protocol:   'https',
    user:       'spongebob',
    password:   'pl4nkt0n'
}).authenticate().catch(function(e){
    throw(`failed to authenticate! ${e}`);
});

```

You can send all of the arguments to **authenticate()** as you would to the constructor (server, user, password, etc), however these arguments will *overwrite* corresponding attributes that already exist in the object (for instance if you were calling authenticate on a previously instantiated object)


## isAuthenticated

```javascript
if (api.isAuthenticated){
    console.log("I'm logged into Remedy!");
}else{
    console.log("I'm not logged into Remedy!");
}
```

pretty straightforward, this attribute is true if we've called **authenticate()** already and false if we haven't. NOTE: this doesn't check to make sure we're *still* authenticated (like checking to see if the session is expired or anything). It just checks to see if we've previously called **authenticate()** successfully is all.


## logout()
```
await api.logout();
```

This force-invalidates the API token for the user's session on the ARServer (logs the user out). It doesn't even return an error. If something goes wrong it just returns true, though it is asynchronous, so it does return a promise and you can await it.


## query()
```javascript
let resultList = await api.query({
    schema:         formName,
    fields:         ['array of', 'field names', 'to get values', 'for'],
    QBE:            QBEstring,
    offset:         integer,                        // return results starting at this row number
    limit:          maxNumberOfRowsToGet,
    sort:           aStringIndicatingSortOrder      // see the docs. but basically <field>.asc or <field>.desc comma separated>
    getAttachments: true
}).catch(function(e){
    throw(`query failed: ${e}`)
})
```

As you might imagine, this function allows you to execute a query (**QBE**) against a given form (**schema**), retrieving selected **field** values from selected records. "QBE" stands for [Query By Example](https://en.wikipedia.org/wiki/Query_by_Example) which is what remedy "Qualifications" actually are. I have to admit, Remedy embracing this technology back in the early 90's was quite visionary.

* **schema**
  this is the name of the form you want to query against. If this was SQL, it'd be the table name.

* **fields**
  this is an array of field names on the form specified by **schema** for which you'd like to get data. If this was SQL, it'd be the select statement.

* **QBE**
  the "query string" (aka "qualification"). If this was SQL, this would be the where clause

* **offset**
  optional. if not set we just start at row 1. However, if you set it, we'll only return results starting at whatever row you specify. This is handy, of course, if you're building a paginated record display or whatnot.

* **limit**
  optional. if not set, we just return everything up to the limit set on the server. Otherwise we only return this many rows. Again, really this is for building paginated displays.

* **sort**
  [the documentation from BMC](https://docs.bmc.com/docs/ars1805/entry-formname-804716411.html#id-/entry/{formName}-GETmultipleentries) is hilariously sparse on this topic. As far as I can tell, you can at least specify ascending ("asc") and descending ("desc") by appending that with a dot to the field name. Yeah I don't even know. If you specify it, I'll send it to the server. You may or may not get back what you're expecting. Who knows. BMC does documentation the way my kids do the dishes y'know?

* **fetchAttachments**
  optional, if not specified defaults to false. If true, AND you have specified at least one attachment field on **fields**, the function will fetch the binary data for each attachment and return it inline with results (see below)

The function returns the same datastructure as returned by the API:

```javascript
{
"entries": [
	{
      "values":
		{
         "fieldName": "fieldValue",
         "fieldBName": "fieldBValue" ... etc ...
		},
	"_links":{
		"self":[
			{"href":"http://localhost:8008/api/arsys/v1/entry/SimpleForm/000000000000103"
            }
          ]
	    }
    }
  ],
  "_links":{
		"self":[
	            {"href":"http://localhost:8008/api/arsys/v1/entry/SimpleForm"
                }
              ]
          }
}
```

Note that basically what you're gettin' here is an array of hashes where each hash key is a field name and each key value is the field's contents. There's also this '_links' section which gives you the REST URL for accessing each row, and also one for the form.

OK, so there's one exception to the above, and that's when you have **fetchAttachments** set true and you've selected an attachment field in **fields**. Let's start this discussion with how attachment fields are represents in **values** when you *don't* have **fetchAttachments** enabled. In that scenario, you'll get something like this:

```javascript
'Attachment Field Name':{
    name:       'spongeBob.PNG',
    sizeBytes:  692080,
    href:       'https://....'
} ...
```

So by default, it'll tell you the filename, and size and where to fetch it from. If you have **fetchAttachments** enabled, you'll see this in **values** instead:

```javascript
'Attachment Field Name':{
    name:       'spongeBob.PNG',
    sizeBytes:  692080,
    href:       'https://....',
    data:       giganticArrayBuffer
} ...
```

so yeah, we just go ahead and fetch the data for any attachment fields you selected if you set **fetchAttachments** true. This also works on **getTicket()**


## getTicket()
```javascript
let ticketData = await api.getTicket({
    schema:     formName,
    ticket:     entryId,
    fields:     ['array of', 'field names', 'to get values', 'for'],
}).catch(function(e){
    throw(`I died tryin'!: ${e}`);
});
```

Fetch field values when you know the ticket number (aka 'entryId', aka "field number 1 on the form"). This is pretty much just a special case of query that can only return 0 or 1 rows. The returned data structure is slightly different in that there is no 'entries' object, it just starts at 'values':

```javascript

{
  "values":
	{
     "fieldName": "fieldValue",
     "fieldBName": "fieldBValue" ... etc ...
	},
"_links":{
	"self":[
		{"href":"http://localhost:8008/api/arsys/v1/entry/SimpleForm/000000000000103"
        }
      ]
    }
}
```
as with **query()**, you can set **getAttachments** true to fetch attachment binary content and return it inline with field data.


## getAttachment()
```javascript
let bigOldArrayBuffer = await api.getAttachment({
    schema:         formName
    ticket:         entryId
    fieldName:      attachmentFieldName
}).catch(function(e){
    throw(`I tried to rock a rhyme, but the server said it's not that eas-ayy: ${e}`)
})
```

this returns *just* the binary data in an arrayBuffer. No datastructure or any of that jazz. Just the data.


## createTicket()
```javascript
let ticketIdentifier = await api.createTicket({
    schema:         formName,
    fields:         {
        "fieldName":    "value for field",
        "fieldBName":   "value for this other field"
        ...
    }
}).catch(function(e){
    throw(`failed to create ticket: ${e}`);
});
```

This creates a ticket in the given **schema** with the given **field** values, or it dies tryin'. Like Fiddy. Upon success, it returns an object of the form:

```javascript
{
    entryId:        anEntryId  // value from field number 1 on the created record, whatever the name of that field may be
    url:            aURL       // the REST URL for the newly created record
}
```


## modifyTicket()
```javascript
await api.modifyTicket({
    schema:     formName,
    ticket:     entryId,
    fields:     {
        "fieldOne": "valueForFieldOne",
        "fieldTwo": "valueForFieldTwo"
        ...
    }
}).catch(function(e){
    throw(`failed to modify ticket!: ${e}`);
});
```

this updates the given **ticket** on the given **schema** with the given **field** values, or dies tryin'.


## deleteTicket()
```javascript
let deletedEntryId = await api.deleteTicket({
    schema:     formName,
    ticket:     entryId
}).catch(function(e){
    throw(`failed to delete ticket: ${e}`);
});
```

deletes the specified **ticket** on the specified **schema** if the user you've authenticated as has permission to do so. it returns the entryId of the ticket you deleted because ... well I dunno why, but it just seemed like a cool thing to do y'know?


## mergeData()
```javascript
let ticketIdentifier = await api.mergeData({
    fields:                 {fieldOne:valueOne, fieldTwo:valueTwo ...},
    QBE:                    qualification,          // (optional)
    handleDuplicateEntryId: enum,                   // error | create | overwrite | merge | alwaysCreate (default error)
    ignorePatterns:         bool,                   // (default false)
    ignoreRequired:         bool,                   // (default false)
    workflowEnabled:        bool,                   // (default true)
    associationsEnabled:    bool,                   // (default true)
    multimatchOption:       enum                    // error | useFirstMatching (default error)
}).catch(function(e){
    throw(`merge failed! ${e}`);
});
console.log(`I merged data into: ${ticketIdentifier.entryId}`);
```

OK, what does mergeData() do? Are you familiar with the BMC Data Import tool? This API call is basically the back-end to that. This function allows you to take a set of field values and a form and say "go update it or make it".

As usual, the [BMC Documentation](https://docs.bmc.com/docs/ars1805/mergeentry-formname-804716415.html) is laughably incomplete, so most of what I've got going on here, I had to reverse engineer by trial and error. Is it *supposed* to work this way or is the way that it works right now the result of buggy software that sailed through dev, right past QA and onto a customer's server? I don't even know. I can't know. Only BMC can know. And they sure as heck ain't writing it down *if they even know* So ... yeah, a'spelunking we will go!

Let's start with "how does it know whether to make a new one or update an existing one?".
As far as I can tell, it knows this by one of two methods:

1. if you included the fieldName for the field with fieldId #1 (i.e. the "ticket number", "request id", "entry id", yadda yadda), in the **fields** argument, and the *value for that field* matches an existing record, then it will try to update that record (depending on **handleDuplicateEntryId** more on that in a minute).

2. if you specified a **QBE** qualification that matched one or more rows (depending on **multimatchOption**). If that's the case, AND you've got **handleDuplicateEntryId** set to something other than error THEN it will ignore 'entryId' in **fields** (if you have one there) and it will update the single record identified by **QBE**. If the record identified by **QBE** has a different 'entryId', it's just gonna silently dump it from **fields**

ok so that's how it figures out the existing record to update, and if all that fails, it just makes a new one with a couple exceptions:

* if **handleDuplicateEntryId** is set to "error", it's just gonna throw an error
* if **handleDuplicateEntryId** is set to "alwaysCreate", it's just gonna always create one

so here's all the options. there are many:

* **fields**
  an object containing field names and values

* **QBE**
  same thing as on query. find records matching this QBE qualification and update one of them or error

* **multimatchOption**
  this is one of "error" or "useFirstMatching", if not specified it defaults to "error". In the case where **QBE** is specified, this indicates how to handle things if the QBE matches more than one record. Obviously a value of "error" means we'll be seein' ya in the Fiddy Block, and a value sof "useFirstMatching" means just treat the first result like it was the only result and keep on truckin'

* **handleDuplicateEntryId**
  this is one of the following:

  * **error**
    throw an error if **QBE** or an 'entryId' on **fields** matches an existing record

  * **create**
    if **QBE** is specified and either matches an existing record or no records, OR if **fields** contains an 'entryId' value that DOES match an existing record create a new record with the given field values. If 'entryId' IS specified BUT does not match any existing value, create a new record on the specified schema with the given field values AND use that value for 'entryId'

  * **overwrite**
    if **QBE** is specified and either matches an existing record OR if **fields** contains an 'entryId' value that DOES match an existing record, delete the existing record from the database and replace it wholesale with the given field values. This one is insidious, in that it is quite easy to blow away create date / modify date, etc unintentionally. Be careful with this one mmmm'kay?

  * **merge**
    if **QBE** is specified and either matches an existing record OR if **fields** contains an 'entryId' value that DOES match an existing record, update the existing record with the given field values, leaving all other fields in place. **EXCEPT NOT FOR REQUIRED FIELDS**. You must supply a value for ALL required fields on this. If you leave 'em null, you're gonna get the "can't reset required field to null" error. For non-required fields it works pretty much like modifyTicket().

  * **alwaysCreate**
    just forget everything and make a new entryId for it. Yes, even if you have **QBE** set and it matches something, or if you have an 'entryId' in **fields**.

Here's the best pseudo-code representation of what's going on at the server side that I can muster:

```javascript
if (QBE specified){
    if (QBE has matches){

        // it no longer cares about 'Entry ID' in your field list
        if (FieldList has an 'Entry ID'){ discard it; }

        // handle multiple matches
        if (QBE matches > 1) && (multimatchOption == 'error'){
            throw(error);
        }else if (QBE matches > 1) && (multimatchOption == 'useFirstMatching'){
            discard all QBE results except the first one;
        }

        // check handleDuplicateEntryId
        switch(handleDuplicateEntryId){
            case 'error':
                // ya rly, but that's what it does ...
                throw(error);
                break;
            case 'create':
                // what was the point of the QBE?
                create_a_new_ticket_and_exit();
                break;
            case 'overwrite':
                delete_QBE_match_and_replace_with_given_field_data();
                break;
            case 'merge':
                update_existing_record_with_given_field_data();
                // except for required fields ... again, I dunno, that's just what it seems to do
                break;
            case 'alwaysCreate':
                // how is this different from 'create'? doesn't seem to be in this context anyhow.
                create_a_new_ticket_and_exit();
                break;
        }
    }else{
        // shrug ... that seems to be how it works
        if (handleDuplicateEntryId == 'error'){ throw(error); }

        // create it
        if ((FieldList has an 'Entry ID') && (FieldList['Entry ID'] does not match an existing record)){
            use given 'Entry ID';
        }
        create_a_new_ticket_and_exit();
    }
}else if (FieldList has an 'Entry ID'){
    if (FieldList['Entry ID'] matches an existing record){
        // check handleDuplicateEntryId
        switch(handleDuplicateEntryId){
            case 'error':
                // ya rly, but that's what it does ...
                throw(error);
                break;
            case 'create':
                discard FieldList['Entry ID'];
                create_a_new_ticket_and_exit();
                break;
            case 'overwrite':
                delete_Entry_ID_match_and_replace_with_given_field_data();
                break;
            case 'merge':
                update_existing_record_with_given_field_data();
                // except for required fields ... again, I dunno, that's just what it seems to do
                break;
            case 'alwaysCreate':
                // how is this different from 'create'?
                create_a_new_ticket_and_exit();
                break;
        }
    }else{
        use given 'Entry ID';
        create_a_new_ticket_and_exit();
    }
}
```
