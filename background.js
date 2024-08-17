var open_options = function() {
        if (chrome.runtime.openOptionsPage) {
            return chrome.runtime.openOptionsPage();
        }
        return chrome.tabs.create({
            url: chrome.runtime.getURL('options.html')
        });
    },

    combo_valid = async function() {
        const {valid, app_id, app_secret} = await chrome.storage.local.get(['valid', 'app_id', 'app_secret']);

        if (!valid || !app_id || !app_secret) {
            open_options();
            return false;
        }
        return true;
    },

    show_badge_text = function(color, text, timeout){
        chrome.action.setBadgeBackgroundColor({
            'color': color
        });
        chrome.action.setBadgeText({
            'text': text
        });
        setTimeout(function() {
            chrome.action.setBadgeText({
                'text': ''
            });
        }, timeout * 1000);
    },

    get_tenant_access_token = async function() {
        const {app_id, app_secret} = await chrome.storage.local.get(['app_id', 'app_secret']);

        if (!app_id || !app_secret) {
            open_options();
            return null;
        }

        var url = 'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal';

        let data = {
            app_id: app_id,
            app_secret: app_secret
        };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json; charset=utf-8'
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                throw new Error("Network response was not ok.");
            }

            const responseData = await response.json();

            if (responseData.code === 0) {
                await chrome.storage.local.set({
                    'tenant_access_token': responseData.tenant_access_token,
                    'token_expire_time': Date.now() + responseData.expire * 1000
                });
                return responseData.tenant_access_token;
            } else {
                throw new Error(responseData.msg);
            }
        } catch (error) {
            console.error(`Fetch Error: ${error}`);
            alert('Error getting tenant_access_token: ' + error);
            return null;
        }
    },

    refresh_token_if_needed = async function() {
        const {token_expire_time} = await chrome.storage.local.get(['token_expire_time']);

        if (!token_expire_time || Date.now() > token_expire_time - 30 * 60 * 1000) {  // If token will expire within 30 minutes
            return await get_tenant_access_token();
        }

        const {tenant_access_token} = await chrome.storage.local.get(['tenant_access_token']);
        return tenant_access_token;
    },

    push_message = async function(source, tab, selection, device) {
        if (!await combo_valid()) {
            return false;
        }

        const tenant_access_token = await refresh_token_if_needed();
        if (!tenant_access_token) {
            return false;
        }

        if (selection) {
            var text = selection.substring(0, 512);
        } else {
            var text = tab.url.substring(0, 500);
        }

        const {receive_id, receive_id_type} = await chrome.storage.local.get(['receive_id', 'receive_id_type']);
        var url = `https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=${receive_id_type}`;

        let msgContent = {
            text: text + `\n\nFrom: \n${tab.title}\n${tab.url}`
        };

        const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });

        let data = {
            receive_id: receive_id,
            msg_type: "text",
            content: JSON.stringify(msgContent),
            uuid: uuid
        };

        fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + tenant_access_token,
                'Content-Type': 'application/json; charset=utf-8'
            },
            body: JSON.stringify(data)
        })
            .then((response) => {
                if (!response.ok) {
                    throw new Error("Network response was not ok.");
                } else {
                    return response.json();
                }
            })
            .then((data) => {
                if (data.code === 0) {
                    show_badge_text('#006400', '✓', 2);
                } else {
                    throw new Error(data.msg);
                }
            })
            .catch((error) => {
                show_badge_text('#ff0000', '✗', 2);
            });

        return false;
    },

    setup_context_menus = function() {
        var devices = ['Feishu'],
            ctxs = ['page', 'link', 'image', 'selection'];
        chrome.contextMenus.removeAll();
        if (devices.length) {
            for(var j = 0; j < ctxs.length; j++) {
                for (var i = 0; i < devices.length; i++) {
                    chrome.contextMenus.create({
                        'title': 'Push this ' + ctxs[j] + ' to ' + devices[i],
                        'contexts': [ctxs[j]],
                        'id': 'ctx:' + ctxs[j] + ':' + devices[i]
                    });
                }
            }
        }
    };

chrome.action.onClicked.addListener(function(tab) {
    chrome.tabs.sendMessage(tab.id, {
        method: 'selection'
    }, function(text) {
        push_message('badge', tab, text);
    });
});

chrome.runtime.onMessage.addListener(function(request) {
    if (request && request.action == "reload-contextmenus") {
        setup_context_menus();
    }
});

chrome.contextMenus.onClicked.addListener(function(info, tab) {
    var devices = ['Feishu'];
    if (devices.length) {
        for (var i = 0; i < devices.length; i++) {
            if (info.menuItemId === 'ctx:page:' + devices[i]) {
                return push_message('menu', tab, '', devices[i]);
            } else if (info.menuItemId === 'ctx:link:' + devices[i]) {
                return push_message('menu', tab, info.linkUrl, devices[i]);
            } else if (info.menuItemId === 'ctx:image:' + devices[i]) {
                return push_message('menu', tab, info.srcUrl, devices[i]);
            } else if (info.menuItemId === 'ctx:selection:' + devices[i]) {
                return push_message('menu', tab, info.selectionText, devices[i]);
            }
        }
    }
});

if (combo_valid()) {
    setup_context_menus();
}