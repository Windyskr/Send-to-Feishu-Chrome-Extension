var $ = function(id) {
        return document.getElementById(id);
    },

    show_message = function(message, hide_in_seconds) {
        $('message').innerHTML = message;
        if (hide_in_seconds) {
            setTimeout(function() {
                $('message').innerHTML = '&nbsp;';
            }, hide_in_seconds * 1000);
        }
    },

    validate = async function() {
        const {app_id, app_secret, receive_id, receive_id_type} = await chrome.storage.local.get(['app_id', 'app_secret', 'receive_id', 'receive_id_type']);

        if (!app_id || !app_secret || !receive_id || !receive_id_type) {
            show_message('Please fill all fields!');
            return;
        }

        var url = 'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal';

        let data = {
            app_id: app_id,
            app_secret: app_secret
        };

        const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });

        fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json; charset=utf-8'
            },
            body: JSON.stringify(data)
        })
            .then(async (response) => {
                if (!response.ok) {
                    throw new Error("Wrong App ID or App Secret.");
                } else {
                    return response.json();
                }
            })
            .then(async (data) => {
                if (data.code === 0) {
                    await chrome.storage.local.set({
                        'tenant_access_token': data.tenant_access_token,
                        'token_expire_time': Date.now() + data.expire * 1000,
                        'valid': 'true'
                    });

                    // Test sending a message
                    return fetch(`https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=${receive_id_type}`, {
                        method: 'POST',
                        headers: {
                            'Authorization': 'Bearer ' + data.tenant_access_token,
                            'Content-Type': 'application/json; charset=utf-8'
                        },
                        body: JSON.stringify({
                            receive_id: receive_id,
                            msg_type: "text",
                            content: JSON.stringify({text: '"Send to Feishu" configured successfully!'}),
                            uuid: uuid
                        })
                    });
                } else {
                    throw new Error(data.msg);
                }
            })
            .then(response => response.json())
            .then(data => {
                if (data.code === 0) {
                    show_message('"Send to Feishu" configured successfully!');
                } else {
                    throw new Error(data.msg);
                }
            })
            .catch((error) => {
                console.error(`Fetch Error: ${error}`);
                if (error.response) {
                    console.error('Error data:', error.response.data);
                    console.error('Error status:', error.response.status);
                    console.error('Error headers:', error.response.headers);
                } else if (error.request) {
                    console.error('Error request:', error.request);
                } else {
                    console.error('Error message:', error.message);
                }
                alert('Error: ' + error);
                show_message('Configuration failed: ' + error);
            });
    },

    save = async function() {
        await chrome.storage.local.set({
            'app_id': $('app_id').value,
            'app_secret': $('app_secret').value,
            'receive_id': $('receive_id').value,
            'receive_id_type': $('receive_id_type').value
        });
        show_message('Saved!');

        validate();
    },

    load = async function() {
        const {app_id, app_secret, receive_id, receive_id_type} = await chrome.storage.local.get(['app_id', 'app_secret', 'receive_id', 'receive_id_type']);
        $('app_id').value = app_id || '';
        $('app_secret').value = app_secret || '';
        $('receive_id').value = receive_id || '';
        $('receive_id_type').value = receive_id_type || '';
    },

    setup_context_menus = function() {
        chrome.runtime.sendMessage({action: "reload-contextmenus"});
    };

$('save').addEventListener('click', save);
window.addEventListener("load", load);
$('setup').addEventListener('click', setup_context_menus);