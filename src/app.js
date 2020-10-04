window.jQuery = require('jquery');
window.$ = window.jQuery;
require('bootstrap');
require('brutusin-json-forms');
require('brutusin-json-forms/dist/js/brutusin-json-forms-bootstrap');
import Cookie from 'js-cookie';
import { parsePhoneNumberFromString } from 'libphonenumber-js';

class InvalidCompanyRecord extends Error {
    constructor(msg = 'InvalidCompanyRecord') {
        super(msg);
        this.name = 'InvalidCompanyRecord';
    }
}

function errorhandler(err, data) {
    if (err instanceof InvalidCompanyRecord) {
        document.getElementById('json-result').textContent =
            'Warning: Invalid record!\n\n' + JSON.stringify(data, null, 4);
        alert('Warning: Record is not valid! Please correct before submitting.');
    } else {
        throw err;
    }
}

function getInputForLabelText(label_text) {
    return document.getElementById(jQuery("label:contains('" + label_text + "')").attr('for'));
}

function triggerOnChange(element) {
    element.dispatchEvent(new Event('change', { bubbles: true }));
}

// Adapted after: https://gist.github.com/miohtama/1570295
function parseFragmentArgs(url) {
    url = url || window.location.href;
    var vars = {};
    var hashes = url.slice(url.indexOf('#!') + 2).split('&');

    for (var i = 0; i < hashes.length; i++) {
        var hash = hashes[i].split('=');

        if (hash.length > 1) vars[hash[0]] = decodeURIComponent(hash[1]);
        else vars[hash[0]] = null;
    }

    return vars;
}

var bf;

fetch(schema_url)
    .then((res) => res.json())
    .then((out) => {
        loadSchema(out);
    })
    .catch((err) => {
        throw err;
    });

function loadSchema(schema) {
    var BrutusinForms = brutusin['json-forms'];
    BrutusinForms.addDecorator(function (element, schema) {
        element.placeholder = '';
    });
    bf = BrutusinForms.create(schema);
    var container = document.getElementById('company-form');

    var template;

    try {
        var json = parseFragmentArgs().doc || Cookie.get('record_template');
        template = json ? JSON.parse(json) : null;
    } catch (e) {
        template = null;
        console.error('Failed to parse JSON doc or template.', e);
    }

    bf.render(container, template);

    // Add phone and fax number helpers
    var inputs = [getInputForLabelText('Phone:'), getInputForLabelText('Fax:')];
    inputs.forEach(function (element) {
        element.parentNode.style.position = 'relative';
        var link = document.createElement('a');
        link.textContent = 'f';
        link.style.position = 'absolute';
        link.style.top = '12px';
        link.style.right = '12px';
        link.style.fontSize = '16px';
        link.title = 'Format number';

        var formatPhoneNumber = function () {
            element.value = new parsePhoneNumberFromString(
                element.value,
                prompt(
                    'Enter a fallback country (as an ISO 3166-1 alpha-2 country code), e.g. "fr", "gb", or "de".'
                ).toUpperCase()
            ).formatInternational();
            triggerOnChange(element);
        };

        link.onclick = formatPhoneNumber;

        element.addEventListener('keyup', function (event) {
            event.preventDefault();
            if (event.keyCode === 13) {
                formatPhoneNumber();
            }
        });

        element.parentNode.appendChild(link);
    });

    // Add email helper
    getInputForLabelText('Email:').addEventListener('keyup', function (event) {
        event.preventDefault();
        if (event.keyCode === 13 && confirm('Set suggested transport medium to email?')) {
            var element = getInputForLabelText('Suggested transport medium:');
            element.value = 'email';
            triggerOnChange(element);
        }
    });

    // Add slug helpers
    getInputForLabelText('Website:').addEventListener('keyup', function (event) {
        event.preventDefault();
        if (event.keyCode === 13 && confirm('Guess slug?')) {
            var element = getInputForLabelText('Slug:');
            element.value = new URL(getInputForLabelText('Website:').value).hostname
                .replace('www.', '')
                .replace(/[^a-z0-9]/g, '-');
            triggerOnChange(element);
        }
    });
    getInputForLabelText('Name:').addEventListener('keyup', function (event) {
        event.preventDefault();
        if (event.keyCode === 13 && confirm('Guess slug?')) {
            var element = getInputForLabelText('Slug:');
            element.value = getInputForLabelText('Name:')
                .value.toLowerCase()
                .replace(/[^a-z0-9]/g, '-');
            triggerOnChange(element);
        }
    });
}

document.getElementById('btn-generate').onclick = function () {
    try {
        displayJson(generateJson());
    } catch (err) {
        errorhandler(err);
    }
};
document.getElementById('btn-download').onclick = downloadJson;
document.getElementById('btn-clear').onclick = function () {
    if (confirm('Do you really want to clear everything?')) {
        window.location.hash = '';
        window.location.reload(false);
    }
};
document.getElementById('btn-copy').onclick = function () {
    try {
        const json = generateJson();
        displayJson(json);
        navigator.clipboard.writeText(json + '\n');
    } catch (err) {
        errorhandler(err);
    }
};

function generateJson() {
    if (!bf.validate()) throw new InvalidCompanyRecord();

    let data = bf.getData();
    // trim the values of data that are strings
    Object.keys(data).forEach((key) => {
        if (typeof data[key] === 'string') {
            data[key] = data[key].trim();
        }
    });
    if (data.address) {
        // trim every line of the address
        data.address = data.address
            .split('\n')
            .map((line) => line.trim())
            .join('\n');
    }
    return JSON.stringify(data, null, 4);
}

function displayJson(json) {
    document.getElementById('json-result').textContent = json;
}

function downloadJson() {
    let data;
    try {
        data = generateJson();
        displayJson(data);
        const a = window.document.createElement('a');
        a.href = window.URL.createObjectURL(new Blob([`${data}\n`], { type: 'text/plain' }));
        a.download = document.getElementById('BrutusinForms#0_0').value + '.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    } catch (err) {
        errorhandler(err, data);
    }
}
