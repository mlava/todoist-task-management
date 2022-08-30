const config = {
    tabTitle: "Todoist Task Management",
    settings: [
        {
            id: "ttt-token",
            name: "Todoist API Token",
            description: "Your API token from https://todoist.com/app/settings/integrations",
            action: { type: "input", placeholder: "Add Todoist API token here" },
        },
        {
            id: "ttt-import-header",
            name: "Roam Research Header",
            description: "Text Header for Roam Research on import",
            action: { type: "input", placeholder: "Imported Tasks" },
        },
        {
            id: "ttt-overdue",
            name: "Include Overdue",
            description: "Include tasks that are overdue in Today's tasks",
            action: { type: "switch" },
        },
        {
            id: "ttt-priority",
            name: "Priority",
            description: "Import the item priority",
            action: { type: "switch" },
        },
        {
            id: "ttt-description",
            name: "Description",
            description: "Import the item description",
            action: { type: "switch" },
        },
    ]
};

let hashChange = undefined;
let keyEventHandler = undefined;
let observer = undefined;

export default {
    onload: ({ extensionAPI }) => {
        extensionAPI.settings.panel.create(config);

        window.roamAlphaAPI.ui.commandPalette.addCommand({
            label: "Import tasks from Todoist",
            callback: () => importTodoistTasks(),
        });
        window.roamAlphaAPI.ui.commandPalette.addCommand({
            label: "Create task in Todoist",
            callback: () => createTodoistTask(),
        });
        window.roamAlphaAPI.ui.commandPalette.addCommand({
            label: "Link to Todoist project via clipboard",
            callback: () => linkTodoistProject(),
        });

        hashChange = async (e) => {
            initiateObserver();
        };
        window.addEventListener('hashchange', hashChange);
        initiateObserver();

        keyEventHandler=function(e){
            if (e.key.toLowerCase() === 'i' && e.shiftKey && e.altKey) {
                importTodoistTasks();
            }
        }
        window.addEventListener('keydown',keyEventHandler, false);

        function initiateObserver() {
            const targetNode1 = document.getElementsByClassName("roam-main")[0];
            const targetNode2 = document.getElementById("right-sidebar");
            const config = { attributes: false, childList: true, subtree: true };
            const callback = function (mutationsList, observer) {
                for (const mutation of mutationsList) {
                    const regex = /#ttm(\d{10})/;
                    if (regex.test(mutation.addedNodes[0]?.textContent) == true && mutation.addedNodes[0]?.childNodes[0]?.children[0]?.control.checked == true) {
                        var taskIDClose = mutation.addedNodes[0].children[2].innerText.split("ttm");
                        var rrUID = mutation.addedNodes[0].lastElementChild.innerText.split("ttm");
                        closeTask(taskIDClose[1], { extensionAPI }, mutation.addedNodes[0].childNodes[1].nodeValue, rrUID[1]);
                    }
                }
            };
            observer = new MutationObserver(callback);
            observer.observe(targetNode1, config);
            observer.observe(targetNode2, config);
        }

        async function importTodoistTasks() {
            var TodoistHeader, key;
            breakme: {
                if (!extensionAPI.settings.get("ttt-token")) {
                    key = "API";
                    sendConfigAlert(key);
                    break breakme;
                } else {
                    const myToken = extensionAPI.settings.get("ttt-token");
                    if (!extensionAPI.settings.get("ttt-import-header")) {
                        TodoistHeader = "Imported tasks";
                    } else {
                        TodoistHeader = extensionAPI.settings.get("ttt-import-header");
                    }
                    const TodoistOverdue = extensionAPI.settings.get("ttt-overdue");
                    const TodoistPriority = extensionAPI.settings.get("ttt-priority");
                    const TodoistGetDescription = extensionAPI.settings.get("ttt-description");

                    var projectIDText = "projectID: ";
                    var currentPageUID;
                    var DNP = false;
                    var startBlock = await window.roamAlphaAPI.ui.mainWindow.getOpenPageOrBlockUid();
                    if (!startBlock) {
                        var uri = window.location.href;
                        const regex = /^https:\/\/roamresearch.com\/#\/(app|offline)\/\w+$/; //today's DNP
                        if (regex.test(uri)) { // this is Daily Notes for today
                            //console.info("Daily Notes for today");
                            var today = new Date();
                            var dd = String(today.getDate()).padStart(2, '0');
                            var mm = String(today.getMonth() + 1).padStart(2, '0');
                            var yyyy = today.getFullYear();
                            startBlock = mm + '-' + dd + '-' + yyyy;
                            DNP = true;
                        }
                    }
                    let q = `[:find (pull ?page [:node/title :block/string :block/uid {:block/children ...} ]) :where [?page :block/uid "${startBlock}"]  ]`;
                    var info = await window.roamAlphaAPI.q(q);
                    if (info.length > 0) {
                        var projectID;
                        if (info[0][0].hasOwnProperty('children')) {
                            for (var i = 0; i < info[0][0]?.children.length; i++) {
                                if (info[0][0].children[i].string.match(projectIDText)) { // This is a project page
                                    projectID = info[0][0].children[i].string.split(projectIDText);
                                }
                            }
                        }
                        currentPageUID = info[0][0].uid;
                    }
                    importTasks(myToken, TodoistHeader, TodoistOverdue, TodoistPriority, TodoistGetDescription, projectID, DNP, currentPageUID);
                }
            }
        }

        async function createTodoistTask() {
            var key;
            breakme: {
                if (!extensionAPI.settings.get("ttt-token")) {
                    key = "API";
                    sendConfigAlert(key);
                    break breakme;
                } else {
                    const myToken = extensionAPI.settings.get("ttt-token");

                    // which page am I on?
                    var startBlock = await window.roamAlphaAPI.ui.getFocusedBlock()?.["block-uid"];
                    if (!startBlock) {
                        alert("Your cursor must be within a block to create as a task in Todoist")
                    }
                    let q = `[:find (pull ?page
                        [:node/title :block/string :block/uid :children/view-type
                         :block/order {:block/children ...} {:block/parents ...}
                        ])
                     :where [?page :block/uid "${startBlock}"]  ]`;
                    var block = await window.roamAlphaAPI.q(q);
                    let parentNumber = parseInt(block[0][0].parents.length) - 1;
                    let parentUID = block[0][0].parents[parentNumber].uid;
                    let blockOrder = parseInt(block[0][0].order) + 1;
                    var projectID;
                    var projectIDText = "projectID: ";

                    var myHeaders = new Headers();
                    var bearer = 'Bearer ' + myToken;
                    myHeaders.append("Authorization", bearer);
                    myHeaders.append("Content-Type", "application/json");
                    const regexContent = /^\{\{\[\[TODO\]\]\}\}.+$/;
                    if (regexContent.test(block[0][0].string)) {
                        var taskContent = block[0][0].string.split("{{[[TODO]]}}");
                        var taskString = '{"content": "' + taskContent[1] + '"';
                    } else {
                        var taskString = '{"content": "' + block[0][0].string + '"';
                    }
                    var url = "https://api.todoist.com/rest/v1/tasks";

                    const regex = /^\d{2}-\d{2}-\d{4}$/;
                    if (regex.test(block[0][0].parents[0].uid)) { // this is a DNP, set a due date
                        var dateString = block[0][0].parents[0].uid.split("-");
                        var todoistDate = dateString[2] + "-" + dateString[0] + "-" + dateString[1];
                        taskString += ', "due_date": "' + todoistDate + '"}';
                    } else if (block[0][0].parents[0].hasOwnProperty('children')) {
                        for (var i = 0; i < block[0][0].parents[0]?.children.length; i++) {
                            if (block[0][0].parents[0].children[i].string.match(projectIDText)) { // This is a project page, set a project_id
                                projectID = block[0][0].parents[0].children[i].string.split(projectIDText)[1];
                            }
                        }
                        taskString += ', "project_id": "' + projectID + '"}';
                    }

                    var requestOptions = {
                        method: 'POST',
                        headers: myHeaders,
                        body: taskString
                    };
                    const response = await fetch(url, requestOptions);
                    const myTasks = await response.text();
                    var task = JSON.parse(myTasks);
                    var newTaskString = "";

                    newTaskString += "{{[[TODO]]}} ";
                    newTaskString += "" + task.content + "";
                    newTaskString += " [Link](" + task.url + ")";
                    newTaskString += " #ttm" + task.id + " ";
                    newTaskString += " #ttm" + startBlock + " ";
                    await window.roamAlphaAPI.updateBlock({
                        block: {
                            uid: startBlock,
                            string: newTaskString.toString()
                        }
                    });
                    await window.roamAlphaAPI.ui.setBlockFocusAndSelection();
                }
            }
        }

        async function linkTodoistProject() {
            var TodoistHeader, key;
            breakme: {
                if (!extensionAPI.settings.get("ttt-token")) {
                    key = "API";
                    sendConfigAlert(key);
                    break breakme;
                } else {
                    const myToken = extensionAPI.settings.get("ttt-token");
                    if (!extensionAPI.settings.get("ttt-import-header")) {
                        TodoistHeader = "Imported tasks";
                    } else {
                        TodoistHeader = extensionAPI.settings.get("ttt-import-header");
                    }
                    const TodoistOverdue = extensionAPI.settings.get("ttt-overdue");
                    const TodoistPriority = extensionAPI.settings.get("ttt-priority");
                    const TodoistGetDescription = extensionAPI.settings.get("ttt-description");

                    const clipText = await navigator.clipboard.readText();
                    const regex = /^\d{10}$/;
                    if (!regex.test(clipText)) {
                        alert('Please make sure that the clipboard contains the (10 digit number) Todoist Project ID');
                    } else {
                        var projectText = "projectID: " + clipText;
                        var startBlock = await window.roamAlphaAPI.ui.mainWindow.getOpenPageOrBlockUid();
                        if (!startBlock) {
                            var uri = window.location.href;
                            const regex = /^https:\/\/roamresearch.com\/#\/(app|offline)\/\w+$/; //today's DNP
                            if (uri.match(regex)) { // this is Daily Notes for today
                                var today = new Date();
                                var dd = String(today.getDate()).padStart(2, '0');
                                var mm = String(today.getMonth() + 1).padStart(2, '0');
                                var yyyy = today.getFullYear();
                                startBlock = mm + '-' + dd + '-' + yyyy;
                            }
                        }
                        let q = `[:find (pull ?page [:node/title :block/string :block/uid {:block/children ...} ]) :where [?page :block/uid "${startBlock}"]  ]`;
                        var info = await window.roamAlphaAPI.q(q);
                        if (info.length > 0) {
                            var projectLinked = false;
                            if (info[0][0].hasOwnProperty('children')) {
                                for (var i = 0; i < info[0][0]?.children.length; i++) {
                                    if (info[0][0].children[i].string.match("projectID: ")) { // there's already a project linked
                                        console.log("Updating project id");
                                        await window.roamAlphaAPI.updateBlock(
                                            { block: { uid: info[0][0].children[i].uid, string: projectText.toString(), open: true } });
                                        projectLinked = true;
                                    }
                                }
                            }
                            if (projectLinked == false) { // no project links, create one from clipboard
                                console.log("Creating project_id link");
                                var thisBlock = window.roamAlphaAPI.util.generateUID();
                                await window.roamAlphaAPI.createBlock({
                                    location: { "parent-uid": info[0][0].uid, order: 999 },
                                    block: { string: "", uid: thisBlock }
                                });
                                thisBlock = window.roamAlphaAPI.util.generateUID();
                                await window.roamAlphaAPI.createBlock({
                                    location: { "parent-uid": info[0][0].uid, order: 999 },
                                    block: { string: "---", uid: thisBlock }
                                });
                                thisBlock = window.roamAlphaAPI.util.generateUID();
                                await window.roamAlphaAPI.createBlock({
                                    location: { "parent-uid": info[0][0].uid, order: 10000 },
                                    block: { string: projectText.toString(), uid: thisBlock }
                                });
                            }
                        }
                    }
                    importTasks(myToken, TodoistHeader, TodoistOverdue, TodoistPriority, TodoistGetDescription, clipText, false, false);
                }
            }
        }
    },
    onunload: () => {
        window.roamAlphaAPI.ui.commandPalette.removeCommand({
            label: 'Import tasks from Todoist'
        });
        window.roamAlphaAPI.ui.commandPalette.removeCommand({
            label: 'Create task in Todoist'
        });
        window.roamAlphaAPI.ui.commandPalette.removeCommand({
            label: 'Link to Todoist project via clipboard'
        });
        window.removeEventListener('hashchange', hashChange);
        observer.disconnect();
        window.removeEventListener('keydown',keyEventHandler, false);
    }
}

function sendConfigAlert(key) {
    if (key == "API") {
        alert("Please set your API token in the configuration settings via the Roam Depot tab.");
    }
}

async function importTasks(myToken, TodoistHeader, TodoistOverdue, TodoistPriority, TodoistGetDescription, projectID, DNP, currentPageUID) {
    const regex = /^\d{2}-\d{2}-\d{4}$/;
    var datedDNP = false;
    if (regex.test(currentPageUID)) {
        var dateString = currentPageUID.split("-");
        var todoistDate = dateString[2] + "-" + dateString[0] + "-" + dateString[1];
        datedDNP = true;
    }
    if (DNP) {
        if (TodoistOverdue == true) {
            var url = "https://api.todoist.com/rest/v1/tasks?filter=Today|Overdue";
        } else {
            var url = "https://api.todoist.com/rest/v1/tasks?filter=Today";
        }
    } else if (projectID) { // a project page
        if (Array.isArray(projectID)) {
            var url = "https://api.todoist.com/rest/v1/tasks?project_id=" + projectID[1];
        } else {
            var url = "https://api.todoist.com/rest/v1/tasks?project_id=" + projectID;
        }
    } else if (datedDNP) { // dated DNP
        var today = new Date();
        var dd = String(today.getDate()).padStart(2, '0');
        var mm = String(today.getMonth() + 1).padStart(2, '0');
        var yyyy = today.getFullYear();
        today = mm + '-' + dd + '-' + yyyy;
        if (currentPageUID != today) {
            var url = "https://api.todoist.com/rest/v1/tasks?filter=" + todoistDate;
        } else {
            if (TodoistOverdue == true) {
                var url = "https://api.todoist.com/rest/v1/tasks?filter=Today|Overdue";
            } else {
                var url = "https://api.todoist.com/rest/v1/tasks?filter=Today";
            }
        }
    }

    var myHeaders = new Headers();
    var bearer = 'Bearer ' + myToken;
    myHeaders.append("Authorization", bearer);
    var requestOptions = {
        method: 'GET',
        headers: myHeaders,
        redirect: 'follow'
    };
    const response = await fetch(url, requestOptions);
    const myTasks = await response.text();
    var task;

    let taskList = [];
    let subTaskList = [];
    for await (task of JSON.parse(myTasks)) {
        if (task.hasOwnProperty('parent_id')) {
            subTaskList.push({ id: task.id, parent_id: task.parent_id, order: task.order, content: task.content });
        } else {
            taskList.push({ id: task.id, uid: "temp" });
        }
    }

    if (Object.keys(taskList).length > 0) {
        var thisBlock;
        thisBlock = await window.roamAlphaAPI.ui.getFocusedBlock()?.["block-uid"];

        if (typeof thisBlock == 'undefined') { // no focused block
            var pageBlock = await window.roamAlphaAPI.ui.mainWindow.getOpenPageOrBlockUid() || currentPageUID;
            thisBlock = window.roamAlphaAPI.util.generateUID();
            await window.roamAlphaAPI.createBlock({
                location: { "parent-uid": pageBlock, order: 0 },
                block: { string: TodoistHeader.toString(), uid: thisBlock }
            });
        } else {
            await window.roamAlphaAPI.updateBlock({
                block: {
                    uid: thisBlock,
                    string: TodoistHeader.toString()
                }
            });
        }

        for (var i = 0; i < taskList.length; i++) {
            for await (task of JSON.parse(myTasks)) {
                if (taskList[i].id == task.id) {
                    // print task
                    var itemString = "";
                    itemString += "{{[[TODO]]}} ";
                    itemString += "" + task.content + "";
                    if (TodoistPriority == true) {
                        if (task.priority == "4") {
                            var priority = "1";
                        } else if (task.priority == "3") {
                            var priority = "2";
                        } else if (task.priority == "2") {
                            var priority = "3";
                        } else if (task.priority == "1") {
                            var priority = "4";
                        }
                        itemString += " #Priority-" + priority + "";
                    }
                    const uid = window.roamAlphaAPI.util.generateUID();
                    itemString += " [Link](" + task.url + ")";
                    itemString += " #ttm" + task.id + " ";
                    itemString += " #ttm" + uid + " ";

                    await window.roamAlphaAPI.createBlock({
                        location: { "parent-uid": thisBlock, order: i },
                        block: { string: itemString, uid }
                    });

                    // print description
                    if (TodoistGetDescription == true && task.description) {
                        const uid1 = window.roamAlphaAPI.util.generateUID();
                        await window.roamAlphaAPI.createBlock({
                            location: { "parent-uid": uid, order: 1 },
                            block: { string: task.description, uid1 }
                        });
                    }

                    // print comments
                    if (task.comment_count > 0) {
                        var url = "https://api.todoist.com/rest/v1/comments?task_id=" + task.id + "";
                        const response = await fetch(url, requestOptions);
                        const myComments = await response.text();
                        let commentsJSON = await JSON.parse(myComments);

                        var commentString = "";
                        for (var j = 0; j < commentsJSON.length; j++) {
                            commentString = "";
                            if (commentsJSON[j].hasOwnProperty('attachment') && TodoistAccount == "Premium") {
                                if (commentsJSON[j].attachment.file_type == "application/pdf") {
                                    commentString = "{{pdf: " + commentsJSON[j].attachment.file_url + "}}";
                                } else if (commentsJSON[j].attachment.file_type == "image/jpeg" || commentsJSON[j].attachment.file_type == "image/png") {
                                    commentString = "![](" + commentsJSON[j].attachment.file_url + ")";
                                } else {
                                    commentString = "" + commentsJSON[j].content + "";
                                }
                            } else if (commentsJSON[j].hasOwnProperty('attachment')) {
                                if (commentsJSON[j].attachment.file_type == "text/html") {
                                    commentString = "" + commentsJSON[j].content + " [Email Body](" + commentsJSON[j].attachment.file_url + ")";
                                }
                            } else {
                                commentString = "" + commentsJSON[j].content + "";
                            }

                            if (commentString.length > 0) {
                                const newBlock = window.roamAlphaAPI.util.generateUID();
                                await window.roamAlphaAPI.createBlock({
                                    location: { "parent-uid": uid, order: j + 1 },
                                    block: { string: commentString, newBlock }
                                });
                            }
                        }
                    }

                    // print subtasks
                    for (var k = 0; k < subTaskList.length; k++) {
                        var results = window.roamAlphaAPI.data.pull("[:block/children]", [":block/uid", uid]);
                        var children = 0;

                        if (results != null) {
                            children = results[":block/children"].length;
                        }
                        if (subTaskList[k].parent_id == task.id) {
                            const newBlock = window.roamAlphaAPI.util.generateUID();
                            await window.roamAlphaAPI.createBlock({
                                location: { "parent-uid": uid, order: k + children },
                                block: { string: subTaskList[k].content, newBlock }
                            });
                        }
                    }
                }
            }
        }
    } else {
        alert("No items to import");
    }
}

async function closeTask(taskIDClose, { extensionAPI }, mutationText, blockUID) {
    console.info("Closing task in Todoist")
    const myToken = extensionAPI.settings.get("ttt-token");
    var myHeaders = new Headers();
    var bearer = 'Bearer ' + myToken;
    myHeaders.append("Authorization", bearer);

    var requestOptions = {
        method: 'POST',
        headers: myHeaders,
        redirect: 'follow'
    };
    var url = "https://api.todoist.com/rest/v1/tasks/" + taskIDClose + "/close";

    const response = await fetch(url, requestOptions);
    if (!response.ok) {
        alert("Failed to complete task in Todoist");
    } else {
        var completedTaskString = "{{[[DONE]]}} ~~" + mutationText + "~~";
        await window.roamAlphaAPI.updateBlock(
            { block: { uid: blockUID, string: completedTaskString.toString(), open: true } });
        console.log("Task Completed in Todoist");
    }
}