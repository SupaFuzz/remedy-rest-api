/*
    test suite for remedy-rest-api.js
*/
const fs = require('fs').promises;
const Remedy = require('./remedy-rest-api.js');
process.stdin.setEncoding('utf8');
let testList = [];
let serverInfo = {};
let testTickets = [];

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
    `remedy-ars-api.js test suite requires login credentials and server info:
        * server   (the hostname of the REST endpoint)
        * protocol (http or https)
        * user     (user to execute tests as)
        * password (password for 'user')\n`);
    let serverInfo = {};
    serverInfo['server'] = await getUserInput('> enter value for "server": ');
    serverInfo['protocol'] = await getUserInput('> enter value for "protocol" [http | https]: ');
    serverInfo['user'] = await getUserInput('> enter value for "user": ');
    serverInfo['password'] = await getUserInput('> enter value for "password": ');
    serverInfo['proxyPath'] = await getUserInput('> enter value for "proxyPath" (enter for none): ');
    serverInfo['port'] = await getUserInput('> enter value for "port" (enter for protocol default): ');
    return(serverInfo);
}
async function doUserPrompt(){
    serverInfo = await getServerInfoFromUser();
    console.log("here's what I got:");
    Object.keys(serverInfo).forEach(function(k){
        if (/^\s*$/.test(serverInfo[k])){
            delete(serverInfo[k]);
        }else{
            console.log(`\t[${k}]: ${serverInfo[k]}`);
        }
    });
    let sw = await getUserInput(`> looks good? [Y/n]`);
    if (/^n/i.test(sw)){ await doUserPrompt(); }
}


// get the connection parameters, then execute the tests
doUserPrompt().then(function(){
    runTest(8);
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




/*
    insert test cases here
*/



/*
    test 0 - authenticate, isAuthenticated, and logout
*/
testList.push(function(){ return(new Promise(function(toot, boot){
    let authAbort = false;
    console.log(`\t* object instantiation with authenticate()`);
    new Remedy(serverInfo).authenticate().catch(function(error){
        authAbort = true;
        boot(error);
    }).then(function(api){ if (! authAbort){
        console.log(`\t* isAuthenticated (true)`)
        if (! api.isAuthenticated){
            boot(new Error('isAuthenticated returned false when api authenticated?'));
        }else{
            console.log(`\t* logout()`)
            let logoutAbort = false;
            api.logout().catch(function(error){
                logoutAbort = true;
                boot(error);
            }).then(function(){
                console.log(`\t* isAuthenticated (false)`)
                if (api.authenticated){
                    boot(new Error('isAuthenticated returned true when api loged out?'));
                }else{
                    toot({status: true, message: "authentication tests"});
                }
            })
        }
    }});
}))});




/*
    test 1 - createTicket with attachment
*/
testList.push(function(){ return(new Promise(function(toot, boot){
    let authAbort = false;
    new Remedy(serverInfo).authenticate().catch(function(error){
        authAbort = true;
        boot(error);
    }).then(function(api){ if (! authAbort){

        // createTicket()
        console.log(`\t* createTicket()`)
        let createAbort = false;
        api.createTicket({
            schema: 'RemedyRestAPI:test form',
            fields: {
                'Name':     "Scooby D Doo"
            }
        }).catch(function(error){
            createAbort = true;
            boot(error);
        }).then(function(result){ if (! createAbort){
            console.log(`\t\t* created RemedyRestAPI:test form/${result.entryId}`);
            testTickets.push(result.entryId);

            // createTicket() with attachment
            console.log(`\t* createTicket() with attachment`);
            let fileReadAbort = false;

            fs.readFile('./test_data/generatedPrettyThing.png', {encoding: 'base64'}).catch(function(error){
                fileReadAbort = true;
                console.log(`failed to read file for attachment: ./test_data/generatedPrettyThing.png: ${error}`);
                boot(new Error(error));
            }).then(function(fileContent){ if (! fileReadAbort){
                api.createTicket({
                    schema: 'RemedyRestAPI:test form',
                    fields: {
                        Name:            "Pretty Picture",
                        test_attachment: 'generatedPrettyThing.png'
                    },
                    attachments: {
                        test_attachment: {
                            name: "generatedPrettyThing.png",
                            encoding: "BASE64",
                            content: fileContent
                        }
                    }
                }).catch(function(error){
                    createAbort = true;
                    boot(error);
                }).then(function(resultTwo){if (! createAbort){
                    testTickets.push(resultTwo.entryId);
                    console.log(`\t\t* create RemedyRestAPI:test form/${resultTwo.entryId} with attachment`);
                    api.logout().then(function(){
                        toot({status: true, message: "createTicket() tests"});
                    });
                }});
            }});
        }});
    }});
}))});





/*
    test 2 - getAttachment
*/
testList.push(function(){ return(new Promise(function(toot, boot){
    let authAbort = false;
    new Remedy(serverInfo).authenticate().catch(function(error){
        authAbort = true;
        boot(error);
    }).then(function(api){ if (! authAbort){
        // getAttachment()
        console.log(`\t* getAttachment()`);
        let abort = false;
        api.getAttachment({
            schema: 'RemedyRestAPI:test form',
            ticket: testTickets[1],
            fieldName: 'test_attachment'
        }).catch(function(error){
            abort = true;
            boot(error);
        }).then(function(data){if (! abort){
            console.log(`\t\t* retrieved ${data.size} bytes`);
            api.logout().then(function(){
                toot({status: true, message: "getAttachment() tests"});
            });
        }});
    }});
}))});




/*
    test 3 - getTicket() with attachment
*/
testList.push(function(){ return(new Promise(function(toot, boot){
    let authAbort = false;
    new Remedy(serverInfo).authenticate().catch(function(error){
        authAbort = true;
        boot(error);
    }).then(function(api){ if (! authAbort){
        console.log(`\t* getTicket()`);
        let abort = false;
        api.getTicket({
            schema: 'RemedyRestAPI:test form',
            ticket: testTickets[0],
            fields: ['Entry ID', 'Status', 'Name']
        }).catch(function(error){
            abort = true;
            boot(error);
        }).then(function(result){ if (! abort){

            console.log(`\t\t* [${result.values['Entry ID']}]: ${result.values.Status} | ${result.values.Name}`);

            // getTicket with attachment
            console.log(`\t* getTicket() with attachment`);
            api.getTicket({
                schema:           'RemedyRestAPI:test form',
                ticket:           testTickets[1],
                fields:           ['Entry ID', 'Status', 'Name', 'test_attachment'],
                fetchAttachments: true
            }).catch(function(error){
                abort = true;
                boot(error);
            }).then(function(resultTwo){ if (! abort){
                console.log(`\t\t* [${resultTwo.values['Entry ID']}]: ${resultTwo.values.Status} | ${resultTwo.values.Name} | ${resultTwo.values.test_attachment.name} (${resultTwo.values.test_attachment.data.size} bytes)`);
                api.logout().then(function(){
                    toot({status: true, message: "getTicket() tests"});
                });
            }});
        }});
    }});
}))});




/*
    test 4 - modifyTicket() with getAttachments
*/
testList.push(function(){ return(new Promise(function(toot, boot){
    let authAbort = false;
    new Remedy(serverInfo).authenticate().catch(function(error){
        authAbort = true;
        boot(error);
    }).then(function(api){ if (! authAbort){
        // modifyTicket()
        console.log(`\t* modifyTicket()`);
        let abort = false;
        api.modifyTicket({
            schema: 'RemedyRestAPI:test form',
            ticket: testTickets[0],
            fields: {
                Name:   "Shaggy N Rogers"
            }
        }).catch(function(error){
            abort = true;
            boot(error);
        }).then(function(data){if (! abort){
            console.log(`\t\t* successfully modified RemedyRestAPI:test form/${testTickets[0]}`);

            let fileReadAbort = false;
            fs.readFile('./test_data/donutChart.png', {encoding: 'base64'}).catch(function(error){
                fileReadAbort = true;
                console.log(`failed to read file for attachment: ./test_data/donutChart.png: ${error}`);
                boot(new Error(error));
            }).then(function(fileContent){ if (! fileReadAbort){

                // modifyTicket() with attachment
                console.log(`\t* modifyTicket() with attachment`);
                api.modifyTicket({
                    schema: 'RemedyRestAPI:test form',
                    ticket: testTickets[0],
                    fields: {
                        Name:               "Shaggy N Rogers",
                        test_attachment:    'donutChart.png'
                    },
                    attachments: {
                        test_attachment: {
                            name: "donutChart.png",
                            encoding: "BASE64",
                            content: fileContent
                        }
                    }
                }).catch(function(error){
                    abort = true;
                    boot(error);
                }).then(function(){ if (! abort){
                    console.log(`\t\t* successfully modified RemedyRestAPI:test form/${testTickets[0]} with attachment (${fileContent.length} bytes)`);
                    api.logout().then(function(){
                        toot({status: true, message: "modifyTicket() tests"});
                    });
                }});
            }});
        }});
    }});
}))});




/*
    test 5 - query() with getAttachments
*/
testList.push(function(){ return(new Promise(function(toot, boot){
    let authAbort = false;
    new Remedy(serverInfo).authenticate().catch(function(error){
        authAbort = true;
        boot(error);
    }).then(function(api){ if (! authAbort){
        // query()
        console.log(`\t* query()`);
        let abort = false;
        api.query({
            schema: 'RemedyRestAPI:test form',
            QBE:    `'Status' = "Good"`,
            fields: ['Entry ID', 'Status', 'Name']
        }).catch(function(error){
            abort = true;
            boot(error);
        }).then(function(data){if (! abort){
            data.entries.forEach(function(row){
                console.log(`\t\t[${row.values['Entry ID']}] ${row.values.Status} | ${row.values.Name}`);
            });

            // query() with fetchAttachments
            console.log(`\t* query() with fetchAttachments`)
            api.query({
                schema: 'RemedyRestAPI:test form',
                QBE:    `'Status' = "Good"`,
                fields: ['Entry ID', 'Status', 'Name', 'test_attachment'],
                fetchAttachments: true
            }).catch(function(error){
                abort = true;
                boot(error);
            }).then(function(dataTwo){if (! abort){
                dataTwo.entries.forEach(function(row){
                    console.log(`\t\t[${row.values['Entry ID']}] ${row.values.Status} | ${row.values.Name} | ${row.values.test_attachment.name} (${row.values.test_attachment.data.size} bytes)`);
                });
                api.logout().then(function(){
                    toot({status: true, message: "query() tests"});
                });
            }});
        }});
    }});
}))});




/*
    test 6 - deleteTicket()
*/
testList.push(function(){ return(new Promise(function(toot, boot){
    let authAbort = false;
    new Remedy(serverInfo).authenticate().catch(function(error){
        authAbort = true;
        boot(error);
    }).then(function(api){ if (! authAbort){
        // query()
        console.log(`\t* deleteTicket()`);
        let abort = false;
        api.deleteTicket({
            schema: 'RemedyRestAPI:test form',
            ticket: testTickets[0]
        }).catch(function(error){
            abort = true;
            boot(error);
        }).then(function(data){if (! abort){
            console.log(`\t\t* deleted ${testTickets[0]}`);
            api.logout().then(function(){
                toot({status: true, message: "deleteTicket() tests"});
            });
        }});
    }});
}))});




/*
    test 7 - getFormOptions()
*/
testList.push(function(){ return(new Promise(function(toot, boot){
    let authAbort = false;
    new Remedy(serverInfo).authenticate().catch(function(error){
        authAbort = true;
        boot(error);
    }).then(function(api){ if (! authAbort){
        // query()
        console.log(`\t* getFormOptions() - RemedyRestAPI:test form`);
        let abort = false;
        api.getFormOptions({
            schema: 'RemedyRestAPI:test form'
        }).catch(function(error){
            abort = true;
            boot(error);
        }).then(function(data){if (! abort){
            console.log(`\t\t* success`);
            console.log(data);
            api.logout().then(function(){
                toot({status: true, message: "getFormOptions() tests"});
            });
        }});
    }});
}))});




/*
    test 8 - getMenu()
*/
testList.push(function(){ return(new Promise(function(toot, boot){
    let authAbort = false;
    new Remedy(serverInfo).authenticate().catch(function(error){
        authAbort = true;
        boot(error);
    }).then(function(api){ if (! authAbort){
        // query()
        console.log(`\t* getMenu() - RemedyRestAPI:test menu`);
        let abort = false;
        api.getMenu({
            name: 'RemedyRestAPI:test menu'
        }).catch(function(error){
            abort = true;
            boot(error);
        }).then(function(data){if (! abort){
            console.log(`\t\t* success`);
            console.log(data);
            api.logout().then(function(){
                toot({status: true, message: "getMenu() tests"});
            });
        }});
    }});
}))});




/*
    test 9 - getMenuValues()
*/
testList.push(function(){ return(new Promise(function(toot, boot){
    let authAbort = false;
    new Remedy(serverInfo).authenticate().catch(function(error){
        authAbort = true;
        boot(error);
    }).then(function(api){ if (! authAbort){
        // query()
        console.log(`\t* getMenuValues() - RemedyRestAPI:test menu`);
        let abort = false;
        api.getMenuValues({
            name: 'RemedyRestAPI:test menu'
        }).catch(function(error){
            abort = true;
            boot(error);
        }).then(function(data){if (! abort){
            console.log(`\t\t* success`);
            console.log(data);
            api.logout().then(function(){
                toot({status: true, message: "getMenuValues() tests"});
            });
        }});
    }});
}))});




/*
    test 10 - getFormFields()
*/
testList.push(function(){ return(new Promise(function(toot, boot){
    let authAbort = false;
    new Remedy(serverInfo).authenticate().catch(function(error){
        authAbort = true;
        boot(error);
    }).then(function(api){ if (! authAbort){
        // query()
        console.log(`\t* getFormFields() - RemedyRestAPI:test form`);
        let abort = false;
        api.getFormFields({
            schema: 'RemedyRestAPI:test form'
        }).catch(function(error){
            abort = true;
            boot(error);
        }).then(function(data){if (! abort){
            console.log(`\t\t* success`);
            console.log(data);
            api.logout().then(function(){
                toot({status: true, message: "getFormFields() tests"});
            });
        }});
    }});
}))});




/*
    test 11 - getRelatedFormsAndMenus()
*/
testList.push(function(){ return(new Promise(function(toot, boot){
    let authAbort = false;
    new Remedy(serverInfo).authenticate().catch(function(error){
        authAbort = true;
        boot(error);
    }).then(function(api){ if (! authAbort){
        // query()
        console.log(`\t* getRelatedFormsAndMenus() - RemedyRestAPI:test form2`);
        let abort = false;
        api.getRelatedFormsAndMenus({
            schema: 'RemedyRestAPI:test form2',
            fetchMenus: true
        }).catch(function(error){
            abort = true;
            boot(error);
        }).then(function(data){if (! abort){
            console.log(`\t\t* success`);
            console.log(data);
            api.logout().then(function(){
                toot({status: true, message: "getFormFields() tests"});
            });
        }});
    }});
}))});




/*
    test 12 - mergeData()
*/
testList.push(function(){ return(new Promise(function(toot, boot){
    let authAbort = false;
    new Remedy(serverInfo).authenticate().catch(function(error){
        authAbort = true;
        boot(error);
    }).then(function(api){ if (! authAbort){
        // query()
        console.log(`\t* mergeData() - RemedyRestAPI:test form`);
        let abort = false;
        api.mergeData({
            schema: 'RemedyRestAPI:test form',
            handleDuplicateEntryId: "error",
            fields: {
                Name: 'Cowabunga!'
            }
        }).catch(function(error){
            abort = true;
            boot(error);
        }).then(function(data){if (! abort){
            console.log(`\t\t* success`);
            console.log(data);
            api.logout().then(function(){
                toot({status: true, message: "mergeData() tests"});
            });
        }});
    }});
}))});
