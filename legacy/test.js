/*
    test suite for remedy-rest-api.js
*/
const Remedy = require('./remedy-rest-api.js');
let testList = [];
let serverInfo = {};
process.stdin.setEncoding('utf8');


/*
    prompt the user for connection parameters
*/
function getUserInput(message){
    return(new Promise(function(resolve, reject){
        process.stdout.write(message);
        process.stdin.resume();
        process.stdin.on('data', function (text) {
            process.stdin.pause();
            resolve(text.replace(/\r?\n|\r/g, ''));
        });
    }));
}
async function getServerInfoFromUser(){
    process.stdout.write(
    `remedy-ars-api.js test suire requires login credentials and server info:
        * server   (the hostname of the REST endpoint)
        * protocol (http or https)
        * user     (user to execute tests as)
        * password (password for 'user')\n`);
    let serverInfo = {};
    serverInfo['server'] = await getUserInput('> enter value for "server": ');
    serverInfo['protocol'] = await getUserInput('> enter value for "protocol" [http | https]: ');
    serverInfo['user'] = await getUserInput('> enter value for "user": ');
    serverInfo['password'] = await getUserInput('> enter value for "password": ');
    return(serverInfo);
}
async function doUserPrompt(){
    serverInfo = await getServerInfoFromUser();
    console.log("here's what I got:");
    Object.keys(serverInfo).forEach(function(k){ console.log(`\t[${k}]: ${serverInfo[k]}`)});
    let sw = await getUserInput(`> looks good? [Y/n]`);
    if (/^n/i.test(sw)){ await doUserPrompt(); }
}



/*
    insert test functions here
*/




/*
    1 - object instantiation and utility functions
        * _ prefixed attributes are private
        * regular args are public attributes
        * default values:
            ** timeout
            ** protocol
            ** debug
            ** _className
        * utility functions
            ** isNull
            ** isNotNull
            ** hasAttribute
            ** epochTimestamp
            ** toEpoch
            ** fromEpoch
*/
async function testUtilityCore(){
    let api;
    try {
        api = new Remedy({
            publicAttribute:    "Hi There",
            _privateAttribute:  "Hello Again"
        });
    }catch(e){
        throw(`\t[fail] object instantiation: ${e}`);
    }
    console.log('\t[ok] object instantiation');

    // check that private vars are not enumerable
    if (Object.keys(api).indexOf('_privateAttribute') >= 0){
        throw("\t[fail]: private attribute is enumberable!");
    }
    console.log(`\t[ok] private attributes are not enumerable`);

    // check that public vars are public
    if ((! api.hasOwnProperty('publicAttribute' )) || (/^\s*$/.test(api.publicAttribute))){
        throw("\t[fail]: public attribute is not accessible!");
    }
    console.log(`\t[ok] public attributes are public`);

    // check default protocol
    if ((! api.hasOwnProperty('protocol')) || (/^\s*$/.test(api.protocol)) || (api.protocol != 'https')){
        throw("\t[fail]: default protocol is not https");
    }
    console.log(`\t[ok] default attributes work`);

    // isNull
    if ((! api.isNull('')) || (! api.isNull(null)) || (! api.isNull('   ')) || (api.isNull('definitelyNotNull'))){
        throw("\t[fail]: isNull returns inconsistent results");
    }
    console.log(`\t[ok] isNull`);

    // isNotNull
    if ((api.isNotNull('')) || (api.isNotNull(null)) || (api.isNotNull('    ')) || (! (api.isNotNull('definitelyNotNull')))){
        throw("\t[fail]: isNotNull returns inconsistent results");
    }
    console.log(`\t[ok] isNotNull`);


    // hasAttribute
    if ((! (api.hasAttribute('publicAttribute'))) || (api.hasAttribute('chewbacca'))){
        throw("\t[fail]: hasAttribute returns inconsistent results");
    }
    console.log('\t[ok] hasAttribute')

    // check epochTimestamp()
    try {
        let low = api.epochTimestamp();
        if (! (/^\d{10}$/.test(low))){ throw(`epochTimestamp low res timestamp appears bogus: ${low}`); }
        console.log(`\t[ok] epochTimestamp (low res): ${low}`);

        let hi = api.epochTimestamp(true);
        if (! (/^\d{13}$/.test(hi))){ throw(`epochTimestamp hi res timestamp appears bogus: ${hi}`); }
        console.log(`\t[ok] epochTimestamp (high res): ${hi}`);

    }catch(e){
        throw(`\t[fail] epochTimestamp does not work properly: ${e}`);
    }

    // check toEpoch
    try {
        let hiResEpoch = api.toEpoch('2014-12-03T22:53:37.000+0000');
        if (hiResEpoch == 1417647217000){
            console.log(`\t[ok] toEpoch(high res): ${hiResEpoch}`)
        }else{
            throw(`\ttoEpoch(high res) returned invalid integer: ${hiResEpoch}`)
        }
        let loResEpoch = api.toEpoch('2014-12-03T22:53:37.000+0000', false);
        if (loResEpoch == 1417647217){
            console.log(`\t[ok] toEpoch(low res): ${loResEpoch}`)
        }else{
            throw(`toEpoch(lo res) returned invalid integer: ${loResEpoch}`)
        }
    }catch(e){
        throw(`\t[fail] ${e}`);
    }

    // check fromEpoch
    try {
        let dateTime = api.fromEpoch('1417647217000', 'dateTime');
        if (dateTime == '2014-12-03T22:53:37.000Z'){
            console.log(`\t[ok] fromEpoch(dateTime): ${dateTime}`)
        }else{
            throw(`fromEpoch(dateTime) returned incorrect value: ${dateTime}`);
        }

        let time = api.fromEpoch('1417647217000', 'time');
        if (time == '22:53:37'){
            console.log(`\t[ok] fromEpoch(time): ${time}`)
        }else{
            throw(`fromEpoch(time) returned incorrect value: ${time}`);
        }

        let date = api.fromEpoch('1417647217000', 'date');
        if (date == '2014-12-03'){
            console.log(`\t[ok] fromEpoch(date): ${date}`)
        }else{
            throw(`fromEpoch(date) returned incorrect value: ${date}`);
        }

        let now = api.fromEpoch(api.epochTimestamp(), 'dateTime');
        console.log(`\t[ok] now: ${now}`);

    }catch(e){
        throw(`\t[fail] ${e}`);
    }

    // it's all good
    return({
        status:     true,
        message:    "instantiation and utility functions passed"
    });
}
testList.push(testUtilityCore);




/*
    2 - authenticate, isAuthenticated logout
*/
async function testAuthenticate(){

    // set up an object
    let api;
    try {
        api = new Remedy(serverInfo);
    }catch(e){
        throw(`\t[fail] object instantiation: ${e}`);
    }
    let str = '';
    Object.keys(serverInfo).forEach(function(s){ str += `\n\t\t[${s}]: ${serverInfo[s]}`; });
    console.log(`\t[ok] object instantiation with attributes: ${str}\n`);

    // test authenticate from instantiated object
    await api.authenticate().catch(function(e){
        throw(`\t[fail]: authenticate: ${e.toString()}`)
    });
    console.log(`\t[ok]: authenticate() with token\n\n${api.token}\n\n`);

    // test isAuthenticated (true)
    if (! api.isAuthenticated){
        throw(`\t[fail]: isAuthenticated returned false for authenticated handle`);
    }
    console.log(`\t[ok]: isAuthenticated (true)`);

    // test logout
    await api.logout().catch(function(e){
        throw(`\t[fail]: logout returned error:\n\t\t${e.toString()}`);
    });
    console.log(`\t[ok]: logout`);

    // test isAuthenticated (false)
    if (api.isAuthenticated){
        throw(`\t[fail]: isAuthenticated returned true for non-authenticated handle`);
    }
    console.log(`\t[ok]: isAuthenticated (false)`);

    // test inline authenticate with instantiation
    api = await new Remedy(serverInfo).authenticate().catch(function(e){
        throw(`\t[fail]: inline authenticate:\n\t\t${e.toString()}`)
    });
    console.log(`\t[ok]: inline authenticate() with token\n\n${api.token}\n\n`);
    await api.logout().catch(function(e){
        throw(`\t[fail]: logout from inline authenticate returned error:\n\t\t${e.toString()}`);
    });

    // test error from bad password/user
    let bkpPass = serverInfo.password;
    let gotError = false;
    serverInfo.password = 'intentionallyBogusPassword';
    api = await new Remedy(serverInfo).authenticate().catch(function(e){
        console.log(`\t[ok]: bad password received expected error\n\t\t${e.toString()}`);
        gotError = true;
    });
    if (! gotError){
        throw(`\t[fail]: intentionally bad password did not throw error!`)
    }

    // test timeout from intentionally bad servername
    serverInfo.password = bkpPass;
    let bkpServer = serverInfo.server;
    gotError = false;

    serverInfo.server  = 'chewbacca.hicox.com';
    serverInfo.timeout = 5000;
    console.log(`\t[testing unreachable server]: ${serverInfo.server} with timeout: ${(serverInfo.timeout/1000)}s ...`);
    api = await new Remedy(serverInfo).authenticate().catch(function(e){
        console.log(`\t[ok]: authenticate to unreachable server received expected error\n\t\t${e.toString()} / ${e.event}`);
        gotError = true;
    });
    if (! gotError){
        throw(`\t[fail]: intentionally unreachable server did not throw error!`)
    }
    serverInfo.server = bkpServer;

    // it's all good
    return({
        status:     true,
        message:    "authentication tests"
    });

}
testList.push(testAuthenticate);




/*
    3 - createTicket / getTicket
*/
let testTicket = '';
async function testCreateTicket(){

    let api = await new Remedy(serverInfo).authenticate().catch(function(e){
        throw(`\t[fail]: inline authenticate:\n\t\t${e.toString()}`)
    });
    console.log("\t[ok] authenticated")


    // create a test ticket
    testTicket = await api.createTicket({
        schema:     'ahicox:remedy-rest-api demo:data',
        fields:     {
            'Item Name':        "SpongeBob",
            'Long Description': "Lives in a pineapple under the sea",
            'Time':             api.fromEpoch(api.epochTimestamp(), 'time'),
            'Date':             api.fromEpoch(api.epochTimestamp(), 'date'),
            'dateTime':         api.fromEpoch(api.epochTimestamp(), 'dateTime'),

            /*
                currency fields require you to give
                at least decimal and currency attributes
                since we don't have access to field meta-data
                under REST, I can't know it's a currency field
                and detect the leading currency sidgil for you
                like I did in Remedy::ARSTools.

                the price of progress I suppose ...
            */
            'Price':            {
                decimal:    4.20,
                currency:   'USD'
            },

            /*
                NOTE LOOSE END -- 6/21/18 @ 1651
                for attachments ...
                https://docs.bmc.com/docs/ars91/en/entry-formname-609071438.html
                yeah ok, I've got some work to do on that.

            */
        }
    }).catch(function(e){
        throw(`\t[fail] createTicket failed: ${e.toString()}`);
    });
    console.log(`\t[ok] created ${testTicket.entryId}`);

    // query it back
    let result = await api.getTicket({
        schema:     'ahicox:remedy-rest-api demo:data',
        fields:     ['Entry ID', 'Item Name', 'Long Description', 'Time', 'Date', 'dateTime'],
        ticket:     testTicket.entryId
    }).catch(function(e){
        throw(`[fail] getTicket failed: ${e.toString()}`);
    });

    /*
        NOTE LOOSE END -- 6/21/18 @ 1656
        would be nice to have a mo betta way of itterating over query results
        y'know?
    */
    console.log(`\t[ok] getTicket`);

    Object.keys(result.values).forEach(function(field){
        console.log(`\t\t[${field}]: ${result.values[field]}`);
    });

    // yo mama don't work here
    await api.logout().catch(function(e){
        throw(`[logout failed?]: ${e.toString()}`);
    });
    console.log(`\t[ok] logout`);

    // it's all good
    return({
        status:     true,
        message:    "createTicket & getTicket tests"
    });
}
testList.push(testCreateTicket);





/*
    4 - modifyTicket / getTicket
*/
async function testModifyTicket(){

    // login
    let api = await new Remedy(serverInfo).authenticate().catch(function(e){
        throw(`\t[fail]: inline authenticate:\n\t\t${e.toString()}`)
    });
    console.log("\t[ok] authenticated");


    // modify it
    await api.modifyTicket({
        schema:         'ahicox:remedy-rest-api demo:data',
        ticket:         testTicket.entryId,
        fields:         {
            'Item Name':       "Squidward"
        }
    }).catch(function(e){
        throw(`[fail] modifyTicket returned error: ${e.toString()}`);
    });
    console.log(`\t[ok] modifyTicket ${testTicket.entryId}`);

    // trust but verify
    let tmp = await api.getTicket({
        schema:         'ahicox:remedy-rest-api demo:data',
        ticket:         testTicket.entryId,
        fields:         ['Item Name']
    }).catch(function(e){
        throw(`[fail] getTicket failed to retrieve previously modified ticket ${testTicket.entryId}: ${e.toString()}`);
    });
    if (tmp.values['Item Name'] !== 'Squidward'){
        throw(`[fail] modifyTicket returned success but did not actually modify the record!`);
    }

    // yo mama don't work here
    await api.logout().catch(function(e){
        throw(`[logout failed?]: ${e.toString()}`);
    });
    console.log(`\t[ok] logout`);

    // it's all good
    return({
        status:     true,
        message:    "modifyTicket tests"
    });
}
testList.push(testModifyTicket);




/*
    5 - mergeData / getTicket
*/
async function testMergeData(){
    // login
    let api = await new Remedy(serverInfo).authenticate().catch(function(e){
        throw(`\t[fail]: inline authenticate:\n\t\t${e.toString()}`)
    });
    console.log("\t[ok] authenticated");

    // no entryId or QBE conflict (intended create/success)
    let result = await api.mergeData({
        schema:         'ahicox:remedy-rest-api demo:data',
        fields:         {
            'Item Name':            "Sandy",
            'Long Description':     "Ocean scientist, karate expert"
        }
    }).catch(function(e){
        throw(`[mergeData (no entryId or QBE conflict)] failed: ${e.toString()}`);
    });
    console.log(`\t[ok] mergeData (no entryId or QBE conflict) / created: ${result.entryId}`);


    // entryId duplicate (error)
    let gotError = false;
    let r2 = await api.mergeData({
        schema:         'ahicox:remedy-rest-api demo:data',
        fields:         {
            'Item Name':            "Sandy",
            'Long Description':     "From TEXAS!",
            'Entry ID':             result.entryId
        }
    }).catch(function(e){
        gotError = true;
        console.log(`\t[ok] mergeData (entryId conflict / error): received expected error\n\t\t${e.toString()}`);
    });
    if (! gotError){
        throw(`[mergeData (entryId conflict / error)]: did not throw error!`);
    }


    // entryId duplicate (create)
    let r3 = await api.mergeData({
        schema:                 'ahicox:remedy-rest-api demo:data',
        handleDuplicateEntryId: "create",
        fields:         {
            'Item Name':            "Sandy",
            'Long Description':     "From TEXAS!",
            'Entry ID':             result.entryId,
            'dateTime':             api.fromEpoch(api.epochTimestamp(), 'dateTime')
        },

    }).catch(function(e){
        throw(`[fail] mergeData (entryId conflict / create) returned error: ${e.toString()}`);
    });
    console.log(`\t[ok] mergeData (entryId conflict / create) created record: ${r3.entryId}`)


    // entryId duplicate (overwrite)
    let r4 = await api.mergeData({
        schema:                 'ahicox:remedy-rest-api demo:data',
        handleDuplicateEntryId: "overwrite",
        fields:         {
            'Item Name':            "Patrick Starr",
            'Long Description':     "lives beneath a rock",
            'Entry ID':             r3.entryId
        }
    }).catch(function(e){
        throw(`[fail] mergeData (entryId conflict / overwrite) returned error: ${e.toString()}`);
    });

    // trust but verify
    if (r4.entryId != r3.entryId){
        throw(`[fail] (entryId conflict / overwrite) created a new entry (${r4.entryId}) instead of overwriting existing entry (${r3.entryId})`)
    }
    let r5 = await api.getTicket({
        schema:     'ahicox:remedy-rest-api demo:data',
        ticket:     r3.entryId,
        fields:     ['Entry ID', 'dateTime']
    }).catch(function(e){
        throw(`[fail] getTicket failed to retrieve overwritten entry: ${r3.entryId}`);
    });

    // overwrite mode should have cleared out dateTime
    if (api.isNotNull(r5.values.dateTime)){
        throw(`[fail] getTicket indicates that overwrite mode did not overwrite entry: ${r3.entryId}`);
    }
    console.log(`\t[ok] mergeData (entryId conflict / overwrite) overwrote record: ${r3.entryId}`)


    // entryId duplicate (merge)
    let r6 = await api.mergeData({
        schema:                 'ahicox:remedy-rest-api demo:data',
        handleDuplicateEntryId: "merge",
        fields:         {
            'Item Name':            "Patrick Starr",
            'dateTime':             api.fromEpoch(api.epochTimestamp(), 'dateTime'),
            'Entry ID':             r3.entryId
        }
    }).catch(function(e){
        throw(`[fail] mergeData (entryId conflict / merge) returned error: ${e.toString()}`);
    });

    /*
        NOTE - there is funny business on the BMC side here

        according to this documentation:
        https://docs.bmc.com/docs/ars91/en/mergeentry-formname-609071442.html

        as well as this documentation:
        https://docs.bmc.com/docs/ars91/en/armergeentry-609070921.html

        "merge" mode (aka "DUP_MERGE"), should only update fields specified in the
        field list. However, if I remove 'Item Name' from the field list above I'm
        going to get the "can't reset a required field to null" error from the server.

        however, it works correctly for NON-REQUIRED fields.
        so ... I guess you always have to specify values for required fields on a "merge"
        even though all you're doing is updating some fields and the damn thing would
        already have a value or it wouldn't exist in the database, but whatevz!!
    */

    // trust but verify
    if (r6.entryId != r3.entryId){
        throw(`[fail] (entryId conflict / merge) created a new entry (${r6.entryId}) instead of merging existing entry (${r3.entryId})`)
    }
    let r7 = await api.getTicket({
        schema:     'ahicox:remedy-rest-api demo:data',
        ticket:     r3.entryId,
        fields:     ['Entry ID', 'dateTime', 'Long Description']
    }).catch(function(e){
        throw(`[fail] getTicket failed to retrieve merged entry: ${r3.entryId}`);
    });

    // merge mode mode should NOT have cleared out dateTime or Long Description
    if (api.isNull(r7.values.dateTime) || api.isNull('Long Description')){
        throw(`[fail] getTicket indicates that merge mode did not merge entry: ${r3.entryId}`);
    }
    console.log(`\t[ok] mergeData (entryId conflict / merge) merged record: ${r3.entryId}`)


    // entryId duplicate (alwaysCreate)
    let r8 = await api.mergeData({
        schema:                 'ahicox:remedy-rest-api demo:data',
        handleDuplicateEntryId: "alwaysCreate",
        fields:         {
            'Item Name':            "Patrick Starr",
            'Long Description':     "money money money money money money money money money money ...",
            'dateTime':             api.fromEpoch(api.epochTimestamp(), 'dateTime'),
            'Entry ID':             r3.entryId
        }
    }).catch(function(e){
        throw(`[fail] mergeData (entryId conflict / alwaysCreate) returned error: ${e.toString()}`);
    });
    if (r8.entryId != r3.entryId){
        console.log(`\t[ok] created new entry: ${r8.entryId}`);
    }else{
        throw(`[fail] mergeData (entryId conflict / alwaysCreate) did not create a new entry`);
    }


    // QBE match (error)
    gotError = false;
    let r9 = await api.mergeData({
        schema:                 'ahicox:remedy-rest-api demo:data',
        handleDuplicateEntryId: "error",
        QBE:                    `'Item Name' = "Sandy"`,
        fields:                 {
            'Item Name':        'Sandy Squirrel'
        }
    }).catch(function(e){
        gotError = true;
        console.log(`\t[ok] mergeData (QBE match / error) returned expected error:\n\t\t${e.toString()}`);
    });
    if (! gotError){
        throw(`[fail] mergeData (QBE match / error) did not return error!`);
    }

    // QBE match (merge)
    let r10 = await api.mergeData({
        schema:                 'ahicox:remedy-rest-api demo:data',
        handleDuplicateEntryId: "merge",
        QBE:                    `'Item Name' = "Sandy"`,
        fields:                 {
            'Item Name':        'Sandy Squirrel'
        }
    }).catch(function(e){
        throw(`[fail] mergeData (QBE match / merge) returned error:\n\t\t${e.toString()}`);
    });
    if (r10.entryId != result.entryId){
        throw(`[fail] mergeData (QBE match / merge) updated/created wrong entry: ${r10.entryId} (should be ${result.entryId})`);
    }
    console.log(`\t[ok] mergeData (QBE match / merge): ${r10.entryId}`)

    /*
        NOTE    ok that's interesting
        we're NOT stuck in overwrite mode.
        it's just that the mergeMode only appears to apply
        to non-required fields. required ones just always gotta be there.
    */


    // QBE multi-match (error)
    gotError = false;
    let r11 = await api.mergeData({
        schema:                 'ahicox:remedy-rest-api demo:data',
        handleDuplicateEntryId: "merge",
        multimatchOption:       "error",
        QBE:                    `'Item Name' = "Patrick Starr"`,
        fields:                 {
            'Item Name':        'Mister Krabbs'
        }
    }).catch(function(e){
        gotError = true;
        console.log(`\t[ok] mergeData (QBE match / merge / multi-match / error): returned expected error:\n\t\t${e.toString()}`);
    });
    if (! gotError){
        throw(`[fail] mergeData (QBE match / merge / multi-match / error) did not generate error!`)
    }


    // QBE multi-match (first-matching)
    let r12 = await api.mergeData({
        schema:                 'ahicox:remedy-rest-api demo:data',
        handleDuplicateEntryId: "merge",
        multimatchOption:       "useFirstMatching",
        QBE:                    `'Item Name' = "Patrick Starr"`,
        fields:                 {
            'Item Name':        'Mister Krabbs'
        }
    }).catch(function(e){
        throw(`[ok] mergeData (QBE match / merge / multi-match / useFirstMatching): returned error:\n\t\t${e.toString()}`);
    });

    let r13 = await api.getTicket({
        schema:     'ahicox:remedy-rest-api demo:data',
        ticket:     r12.entryId,
        fields:     ['Entry ID', 'Item Name']
    }).catch(function(e){
        throw(`[fail] getTicket failed to retrieve merged entry: ${r12.entryId}`);
    });

    // should've updated the 'Item Name'
    if (r13.values['Item Name'] !== 'Mister Krabbs'){
        throw(`[fail] getTicket indicates that merge mode did not merge entry: ${r12.entryId}`);
    }
    console.log(`\t[ok] mergeData (QBE match / merge / multi-match / useFirstMatching): merged record: ${r12.entryId}`)


    // QBE no-match (create)
    let r14 = await api.mergeData({
        schema:                 'ahicox:remedy-rest-api demo:data',
        handleDuplicateEntryId: "create",
        QBE:                     `'Item Name' = "Squidward"`,
        fields:                 {
            'Item Name':        "Squidward",
            'Long Description': "that's me in the show, isn't it?"
        }
    }).catch(function(e){
        throw(`[fail] mergeData (QBE no-match / create) threw error: ${e.toString()}`);
    });
    console.log(`\t[ok] mergeData (QBE no-match / create) created record: ${r14.entryId}`);


    /*
        --> INSERT TESTS HERE <--
    */

    // ignoreRequired (create)

    // ignorePatterns (create)

    // workflowEnabled (create)

    // associationsEnabled (??)


    // yo mama don't work here
    await api.logout().catch(function(e){
        return(Promise.reject(`[logout failed?]: ${e}`));
    });
    console.log(`\t[ok] logout`);

    // it's all good
    return({
        status:     true,
        message:    "mergeData tests"
    });
}
testList.push(testMergeData);




/*
    6 - query / deleteTicket
*/
async function testQueryAndDelete(){

    // login
    let api = await new Remedy(serverInfo).authenticate().catch(function(e){
        throw(`\t[fail]: inline authenticate:\n\t\t${e.toString()}`)
    });
    console.log("\t[ok] authenticated");

    // query
    let r1 = await api.query({
         schema:    'ahicox:remedy-rest-api demo:data',
         QBE:       "'Item Name' != $NULL$",
         fields:    ['Entry ID', 'Item Name']
    }).catch(function(e){
        throw(`[fail] query returned error: ${e.toString()}`)
    });
    console.log(`\t[ok] query returned`);
    r1.entries.forEach(function(row, idx){
        console.log(`\t\t[row] ${(idx + 1)}`);
        Object.keys(row.values).forEach(function(field){
            console.log(`\t\t\t[${field}]: ${row.values[field]}`);
        });
    });

    // delete 'em
    let promiseKeeper = [];
    r1.entries.forEach(function(row, idx){
        promiseKeeper.push(
            api.deleteTicket({
                schema:    'ahicox:remedy-rest-api demo:data',
                ticket:     row.values['Entry ID']
            }).then(function(tkt){
                console.log(`\t[ok] deleted ${tkt}`);
            }).catch(function(e){
                throw(`[fail]: deleteTicket failed to delete ${row.values['Entry ID']}: ${e.toString()}`);
            })
        );
    });
    await Promise.all(promiseKeeper).catch(function(e){
        throw(`[fail]: deleteTicket (Promise.all) returned an error: ${e.toString()}`);
    })

    // yo mama don't work here
    await api.logout().catch(function(e){
        return(Promise.reject(`[logout failed?]: ${e}`));
    });
    console.log(`\t[ok] logout`);
    return({
        status:     true,
        message:    "query and deleteTicket tests"
    });
}
testList.push(testQueryAndDelete);




/*
    execution starts here
*/


// get the connection parameters
doUserPrompt().then(function(){
    // kick off the test suite
    runTest(0);
});


/*
    runTest ------------------------------------------------------
    execute all of the asynchronous tests in the testList in order
    or die tryin' ... like fiddy ...
*/
function runTest(testNumber){
    console.log(`\n[test #${(testNumber + 1)}]`);
    testList[testNumber]().then(function(result){
        if (! result.status){
            console.log(`[test #${(testNumber + 1)}]: did not fail, but did not exit with success. terminating ...`);
            console.log("exiting with error");
            process.exit(1);
        }else{
            console.log(`[OK (test #${(testNumber + 1)})]: ${result.message}`);
            if (testNumber == (testList.length - 1)){
                console.log("[ALL TESTS OK]");
                process.exit(0);
            }else{
                runTest(testNumber + 1);
            }
        }
    }).catch(function(e){
        console.log(`[FAIL (test #${(testNumber + 1)})]: ${e}`);
        console.log("exiting with error");
        process.exit(1);
    });
}
