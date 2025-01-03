const CookieExpiry = 365;
//const refreshPeriod = 30; // seconds
const refreshCounter = 1; // seconds
var prevRecordAtTime;

const shortEnGBFormatter = new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: true,
    timeZoneName: 'short',
});

const timeENGFormatter = new Intl.DateTimeFormat('en-GB', {
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
});

let envMap = {
    Development: 'dev',
    Test: 'test',
    Staging: 'stg',
    Production: 'prod',
    Other: 'oth',
};

let session;
let userInfo;

class AuthenticationError extends Error {
    constructor() {
        super('Failed to authenticate user'); 
        this.name = 'AuthenticationError'; 
    }
}
class SessionInitialiseError extends Error {
    constructor() {
        super('Failed intialise session');
        this.name = 'SessionInitialiseError';
    }
}

class SystemParameterError extends Error {
    constructor() {
        super('Failed system parameter query');
        this.name = 'SystemParameterError';
    }
}

(function ($) {
    $.fn.extend({
        DetailForm: function (options) {

            this.defaultOptions = {
                color: "#556b2f",
                backgroundColor: "pink",
                title: 'Detail Form',
                onLoadedFields: () => {

                },
            };

            var settings = $.extend({}, this.defaultOptions, options);

            this.LoadFields = (data) => {

                settings.fieldDefns.forEach(e => {

                    let value = e.render ? e.render(data[e.data]) : data[e.data];
                    $('input[name=' + e.data + ']', this).val(value);

                });

                settings.onLoadedFields.call(data);

            };


            return this.each(function () {

                $(".header h2", this).text(settings.title);

                let fields = $('.fields', this);
                settings.fieldDefns.forEach(e => {

                    fields.append(
                        `<div class="field">
                        <label>${e.title}</label>
                        <input type="text" name="${e.data}" ${(e.key == true || e.editable == false) ? 'readonly' : ''} placeholder="${e.title}">  
                    </div>`
                    );

                });

            });

        }

    });

})(jQuery);



// Document Ready function...
$(() => {

    // first retrieve some info from the server...
    $('body')
        .dimmer({
            displayLoader: true,
            loaderVariation: 'slow orange medium elastic',
            loaderText: 'Bus Tracker Initialising, please wait...',
            closable: false,
        })
        .dimmer('show');


    // Immediately - invoked asynch Function Expression...
    (async () => {
        // Get user info...
        userInfo = await getUserInfo();
        $('#userInfo').text(JSON.stringify(userInfo, null, 2));

        session = await getSession();
        $('#session').text(JSON.stringify(session, null, 2));

        //let recentSessions = await getRecentSession();
        //$('#recentSessions').text(JSON.stringify(recentSessions, null, 2));

        
    })().then(() => {

        initView();

    }).catch(error => {
        alert(error);
    }).finally(() => {
        $('body').dimmer('hide');    
    });

});

function initView() { 

    // Set user id...
    //$('.user-glyph')
    //    .attr('data-initial', userInfo?.user_initials ?? '?')
    //    .attr('title', userInfo?.user_name ?? '');

    //required for older browser which do not support ?. notation...
    try {
        $('.user-glyph')
            .attr('data-initial', userInfo.user_initials)
            .attr('title', userInfo.user_name);
    }
    catch (err) {
        $('.user-glyph')
            .attr('data-initial', '?')
            .attr('title', 'No user');
    }

    // Set environment glyph..
    $('.env-glyph').addClass(envMap[session.environment] || envMap.Other);

    $('.menu .browse')
        .popup({
            inline: true,
            on: 'click',
            hoverable: true,
            position: 'bottom left',
            prefer: 'adjacent',
            delay: {
                show: 300,
                hide: 500
            },
        }
    );
    
    $('#actionLogout')
        .on('click', (e) => {
            window.location.replace("/.auth/logout")
            e.preventDefault();
        });

    $('.collapsible.column.box .toggle')
        .on('click', (e) => {
            console.log(`${e.delegateTarget.className} - ${e.currentTarget.className} - ${e.target.className}`);
            $(e.currentTarget).next().toggleClass('hidden');
            $(e.currentTarget).toggleClass('long');
            $('i', e.currentTarget)
                .toggleClass('left')
                .toggleClass('right');
        });

    //$('.nav-wrapper .nav-toggle')
    //    .on('click', (e) => {
    //        e.currentTarget.firstElementChild.classList.toggle('right');
    //        e.currentTarget.firstElementChild.classList.toggle('left');
    //        e.currentTarget.nextElementSibling.classList.toggle('hidden');
    //        e.currentTarget.classList.toggle('long');
    //        console.log(e.currentTarget);
    //    });

    //$('.nav-wrapper .nav-contents .nav-list .menu .item')
    //    .tab();

    $('.navigator.box .menu .item')
        .tab();


    $.fn.dataTable.ext.buttons.refresh = {
        text: '<i class="redo icon"></i>&nbsp;Refresh',
        action: (e, dt, node, config) => {
            dt.clear().draw();
            dt.ajax.reload();
        }
    };

    $('#recent-sessions')
        .DataTable({
            pageLength: 5,
            responsive: true,
            fixedHeader: {
                header: true,
                headerOffset: 50,
                footer: true
            },
            dom: '<"top"<"left-col"Bf><"right-col"l>>rtip',
            buttons: [
                'refresh', 'copy', 'excel', 'pdf',
            ],
            ajax: {
                url: '/BusTrackerServices/Session/GetRecent',
                dataSrc: (json => {
                    return JSON.parse(json);
                }),
            },
            autowidth: true,
            order: [[0, 'desc']],
            columns: [
                {
                    title: 'ID',
                    data: 'id',
                    width: '10%', 
                },
                {
                    title: 'Created',
                    data: 'created',
                    width: '10%',
                    render: function (data, type, row, meta) {
                        return shortEnGBFormatter.format(new Date(data));
                    }
                },
                {
                    title: 'Updated',
                    data: 'updated',
                    width: '10%',
                    render: function (data, type, row, meta) {
                        return shortEnGBFormatter.format(new Date(data));
                    }
                },
                {
                    title: 'Latest Event',
                    data: 'event',
                    width: '10%',
                },
                {
                    title: 'header_query_string',
                    data: 'header_query_string',
                    defaultContent: '-',
                    width: '20%',
                },
                {
                    title: 'header_user_agent',
                    data: 'header_user_agent',
                    defaultContent: '-',
                    width: '20%',
                },
                {
                    title: 'header_sec_ch_ua',
                    data: 'header_sec_ch_ua',
                    defaultContent: '-',
                    width: '20%',
                },
                {
                    title: 'History',
                    data: null,
                    render: (data, type, row, meta) => {
                        return `<button class="ui icon button" session-id=${row.id} title="view history"><i class= "history icon" ></i></button >`;
                    },
                    width: '10%',
                },
            ]
        })
        .on('click', 'button', (e) => {
            let sessionId = $(e.currentTarget).attr('session-id');
            showHistory(sessionId);
            e.preventDefault();
        });


    $('#sessionHistory')
        .DataTable({
            pageLength: 5,
            responsive: true,
            dom: '<"top"<"left-col"Bf><"right-col"l>>rtip',
            buttons: [
                'refresh', 'copy', 'excel', 'pdf',
            ],
            ajax: {
                url: '/BusTrackerServices/Session/GetSessionHistory',
                dataSrc: (json => {
                    return JSON.parse(json);
                }),
                data: (p, x, y) => {
                    p.sessionId = $('#sessionHistory').attr('session_id')?? -1;
                }
            },
            autowidth: true,
            order: [[1, 'desc']],
            columns: [
                {
                    title: 'Session ID',
                    data: 'session_id',
                    width: '10%',
                },
                {
                    title: 'Audit ID',
                    data: 'audit_id',
                    width: '10%',
                },
                {
                    title: 'Audit Timestamp',
                    data: 'audit_timestamp',
                    width: '10%',
                    render: function (data, type, row, meta) {
                        return shortEnGBFormatter.format(new Date(data));
                    }
                },
                {
                    title: 'Created',
                    data: 'created',
                    width: '10%',
                    render: function (data, type, row, meta) {
                        return shortEnGBFormatter.format(new Date(data));
                    }
                },
                {
                    title: 'Updated',
                    data: 'updated',
                    width: '10%',
                    render: function (data, type, row, meta) {
                        return shortEnGBFormatter.format(new Date(data));
                    }
                },
                {
                    title: 'Latest Event',
                    data: 'event',
                    width: '10%',
                },
                {
                    title: 'header_query_string',
                    data: 'header_query_string',
                    defaultContent: '-',
                    width: '20%',
                },
                {
                    title: 'header_user_agent',
                    data: 'header_user_agent',
                    defaultContent: '-',
                    width: '20%',
                },
                {
                    title: 'header_sec_ch_ua',
                    data: 'header_sec_ch_ua',
                    defaultContent: '-',
                    width: '20%',
                }
            ]
        });

    let systemParamTable = $('#systemParameters')
        .DataTable({
            pageLength: 10,
            responsive: true,
            dom: '<"top"<"left-col"Bf><"right-col"l>>rtip',
            buttons: [
                'refresh', 'copy', 'excel', 'pdf',
            ],
            select: {
                style: 'single',
                toggleable: false
            },
            ajax: {
                url: '/BusTrackerServices/Admin/GetAllSystemParameters',
                dataSrc: (json => {
                    return JSON.parse(json);
                }),
            },
            autowidth: true,
            order: [[1, 'asc']],
            columns: [
                {
                    title: 'Name',
                    data: 'name',
                    width: '20%',
                },
                {
                    title: 'Value',
                    data: 'value',
                    width: '25%',
                },
                {
                    title: 'Created',
                    data: 'created',
                    width: '15%',
                    render: function (data, type, row, meta) {
                        return shortEnGBFormatter.format(new Date(data));
                    }
                },
                {
                    title: 'Created By',
                    data: 'created_by',
                    width: '10%',
                },
                {
                    title: 'Updated',
                    data: 'updated',
                    width: '15%',
                    render: function (data, type, row, meta) {
                        return shortEnGBFormatter.format(new Date(data));
                    }
                },
                {
                    title: 'Updated By',
                    data: 'updated_by',
                    width: '10%',
                },
                {
                    title: 'Version',
                    data: 'version',
                    width: '5%',
                },
            ],
        })
        .on('select', (e, dt, type, i) => {
            getSystemParameter(dt.data().name)
                .then(systemParameter => {
                    detailForm.LoadFields(systemParameter);
                });
        })
        .on('draw', (e, settings) => {
            systemParamTable.row(':eq(0)', { page: 'current' }).select();
        });

    // form to modify details...
    let detailForm = $('#detailForm')
        .DetailForm({
            title: "System Parameter Details",
            fieldDefns: [
                {
                    title: 'Name',
                    data: 'name',
                    key: true,
                },
                {
                    title: 'Value',
                    data: 'value',
                },
                {
                    title: 'Created',
                    data: 'created',
                    editable: false,
                    render: function (data) {
                        return shortEnGBFormatter.format(new Date(data));
                    }
                },
                {
                    title: 'Created By',
                    data: 'created_by',
                    editable: false,
                },
                {
                    title: 'Updated',
                    data: 'updated',
                    editable: false,
                    render: function (data) {
                        return shortEnGBFormatter.format(new Date(data));
                    }
                },
                {
                    title: 'Updated By',
                    data: 'updated_by',
                    editable: false,
                },
                {
                    title: 'Version',
                    data: 'version',
                    editable: false,
                },
            ],
            onLoadedFields: (data) => {
                $('.form-mode.unsaved', detailForm).removeClass('unsaved');
                $('.button[type=submit]', detailForm).attr('disabled', true);
            },
        })
        .on('input', (e) => {
            $('.form-mode', detailForm).addClass('unsaved');
            $('.button[type=submit]', detailForm).attr('disabled', false);
        })
        .on('submit', (e) => {
            e.preventDefault();

            // Show dimmer on save...
            detailForm
                .dimmer({
                    displayLoader: true,
                    loaderVariation: 'slow orange medium elastic',
                    loaderText: 'Saving changes...',
                    closable: false,
                })
                .dimmer('show');

            // format fields into a JSON object...
            let systemParameter = $(e.delegateTarget)
                .serializeArray()
                .reduce((json, { name, value }) => {
                    json[name] = value;
                    return json;
                }, {});

            updateSystemParameter(systemParameter)
                .then((jsonResponse) => {
                    // check to see if the record has been modified by another user
                    if (jsonResponse.errorCode === "BT-0001") {
                        displayMessage(jsonResponse.message, false);
                        return;
                    }

                    // quick and dirty...
                    detailForm.LoadFields(jsonResponse);
                    systemParamTable.row({ selected: true }).data(jsonResponse);
                })
                .finally(e => {
                    detailForm
                        .dimmer('hide');   
                });


        });

}

async function updateSystemParameter(systemParameter) {
    const jsonResponse = await fetch(`/BusTrackerServices/Admin/UpdateSystemParameter`, {
        method: 'POST',
        headers: {
            "content-type": 'application/json'
        },
        body: JSON.stringify(systemParameter),
        timeout: 5 * 1000,
        cache: 'no-store',
    })
        .then(response => {
            return response.json()
        })
        .then(data => {
            return JSON.parse(data)
        })
        .catch(error => {
            console.log(error);
            throw new SystemParameterError();
        });

    return jsonResponse;
}

async function getSystemParameter(parameterName) {
    const jsonResponse = await fetch(`/BusTrackerServices/Admin/GetSystemParameter?parameterName=${parameterName}`, {
        timeout: 5 * 1000, 
        cache: 'no-store',
    })
        .then(response => response.json())
        .then(data => JSON.parse(data))
        .catch(error => {
            console.log(error);
            throw new SystemParameterError();
        });

    return jsonResponse; 
}

async function getUserInfo() {
    const userInfo = await fetch('/.auth/me', {
        cache: 'no-store',
    })
        .then(response => response.json())
        .then(data => data[0])
        .catch(error => {
            console.log(error);
            throw new AuthenticationError();
        });

    if (userInfo) {
        userInfo.user_name = userInfo.user_claims
            .find(c => c.typ == 'name').val;
        userInfo.user_initials = userInfo.user_name
            .split(' ')
            .map(word => word.charAt(0))
            .filter((e, i) => i < 2)
            .join('');
    }

    return userInfo;
}

async function getSession() {
    const session = await fetch('/BusTrackerServices/Session/Create', {
        timeout: 5 * 1000, // milliseconds, in case the web services are waking up....
        cache: 'no-store',
        //credentials: 'include',
        //headers:
        //{
        //    Authorization: `Bearer ${access_token}`
        //}
    })
        .then(response => response.json())
        .then(data => JSON.parse(data))
        .catch(error => {
            console.log(error);
            throw new SessionInitialiseError();
        });
    return session; // need to parse this to return a JSON obejct rather than string...;
}

async function getRecentSession() {
    const recentSessions = await fetch('/BusTrackerServices/Session/GetRecent', {
        timeout: 5 * 1000, // milliseconds, in case the web services are waking up....
        cache: 'no-store',
        //credentials: 'include',
        //headers:
        //{
        //    Authorization: `Bearer ${access_token}`
        //}
    })
        .then(response => response.json())
        .then(data => JSON.parse(data))
        .catch(error => {
            console.log(error);
            throw new SessionInitialiseError();
        });
    return recentSessions; // need to parse this to return a JSON obejct rather than string...;
}

function showHistory(sessionId) {

    // need to show modal (and the table) before loading the table else columns are all over the place...
    $('#data').modal('show');

    // set the attribute on the HTML table, which is then read by the aja data function...
    $('#sessionHistory').attr('session_id', sessionId);

    $('#sessionHistory').DataTable()
        .clear()
        .ajax.reload()
        .columns.adjust()
        .responsive.recalc()
        .draw()
        ;

}

function displayMessage(content, autoHide = true) {

    var modal = $.modal({
        /*title: title,*/
        class: 'tiny',
        closeIcon: !autoHide,
        content: content,
    })
        .modal('show');

    if (autoHide) {
        modal.delay(1500)
            .queue(function () {
                $(this).modal('hide').dequeue();
            });
    }
}
