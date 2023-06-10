window.jQuery = require('jquery');
window.$ = window.jQuery;
require('bootstrap');
require('brutusin-json-forms');
require('brutusin-json-forms/dist/js/brutusin-json-forms-bootstrap');
import Cookie from 'js-cookie';
import { parsePhoneNumberFromString } from 'libphonenumber-js';

class InvalidCompanyRecord extends Error {
    constructor(json) {
        super('InvalidCompanyRecord');
        this.json = json;
        this.name = 'InvalidCompanyRecord';
    }
}

function errorHandler(err) {
    if (err instanceof InvalidCompanyRecord) {
        document.getElementById('json-result').textContent =
            "Warning: Invalid record!\nWon't copy/download! \n\n" + JSON.stringify(err.json, null, 4);
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

function initializeForm(template) {
    const container = document.getElementById('company-form');
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

        element.addEventListener('keydown', function (event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                formatPhoneNumber();
            }
        });

        element.parentNode.appendChild(link);
    });

    // Add email helper
    getInputForLabelText('Email:').addEventListener('keydown', function (event) {
        if (event.key === 'Enter' && confirm('Set suggested transport medium to email?')) {
            event.preventDefault();
            var element = getInputForLabelText('Suggested transport medium:');
            element.value = 'email';
            triggerOnChange(element);
        }
    });

    // Add slug helpers
    getInputForLabelText('Website:').addEventListener('keydown', function (event) {
        if (event.key === 'Enter' && confirm('Guess slug?')) {
            event.preventDefault();
            var element = getInputForLabelText('Slug:');
            element.value = new URL(getInputForLabelText('Website:').value).hostname
                .replace('www.', '')
                .replace(/[^a-z0-9]/g, '-');
            triggerOnChange(element);
        }
    });
    getInputForLabelText('Name:').addEventListener('keydown', function (event) {
        if (event.key === 'Enter' && confirm('Guess slug?')) {
            event.preventDefault();
            var element = getInputForLabelText('Slug:');
            element.value = getInputForLabelText('Name:')
                .value.toLowerCase()
                .replace(/[^a-z0-9]/g, '-');
            triggerOnChange(element);
        }
    });

    function decorateLink(elem) {
        const old_a = elem.parentNode.querySelector('a');
        if (old_a) {
            old_a.href = elem.value;
            return;
        }
        if (!elem.value) return;
        elem.parentNode.style.position = 'relative';
        const link = document.createElement('a');
        link.className = 'glyphicon glyphicon-link';
        link.style.position = 'absolute';
        link.style.top = '12px';
        link.style.right = '12px';
        link.style.fontSize = '16px';
        link.title = 'Field input as link';
        link.href = elem.value;
        link.target = "_blank";
        elem.parentNode.repl;
        elem.parentNode.appendChild(link);
    }
    // Add link helper for sources
    const elems = [
        getInputForLabelText('PGP URL:'),
        getInputForLabelText('Website:'),
        ...jQuery("label:contains('Sources:')").parent().parent().find('input').toArray(),
    ];

    for (const elem of elems) {
        decorateLink(elem);
        elem.addEventListener('keyup', () => decorateLink(elem));
    }
}

function loadSchema(schema) {
    const BrutusinForms = brutusin['json-forms'];
    BrutusinForms.addDecorator(function (element, schema) {
        element.placeholder = '';
    });
    bf = BrutusinForms.create(schema);

    try {
        const fragmentArgs = parseFragmentArgs();
        if (fragmentArgs.slug || fragmentArgs.url) {
            const url = fragmentArgs.slug
                ? `https://raw.githubusercontent.com/datenanfragen/data/master/companies/${fragmentArgs.slug}.json`
                : fragmentArgs.url;

            fetch(url)
                .then((e) => e.json())
                .then((json) => {
                    initializeForm(json);
                })
                .catch((e) => {
                    console.error('Failed to retrieve or parse JSON doc.', e);
                    initializeForm(null);
                    alert('Failed to retrieve or parse JSON doc.');
                });
        } else {
            let json = null;
            if (fragmentArgs.doc) {
                json = JSON.parse(fragmentArgs.doc);
            } else if (Cookie.get('record_template')) {
                json = JSON.parse(Cookie.get('record_template'));
            }
            initializeForm(json);
        }
    } catch (e) {
        console.error('Failed to parse JSON doc or template.', e);
        initializeForm(null);
        alert('Failed to parse JSON doc or template.');
    }
}

document.getElementById('btn-generate').onclick = function () {
    try {
        displayJson(generateJson());
    } catch (err) {
        errorHandler(err);
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
        errorHandler(err);
    }
};
document.getElementById('btn-load').onclick = function (e) {
    e.preventDefault();
    const slug = document.getElementById('input-slug').value;
    if (!/^[a-z0-9-]+$/.test(slug)) return;
    if (!confirm('Do you really want to load the entry from the database? This discards everything.')) return;
    window.location = window.location.href.split('#')[0] + '#!slug=' + slug;
    window.location.reload();
};

function generateJson() {
    let data = bf.getData();
    Object.keys(data).forEach((key) => {
        // trim the values of data that are strings
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
    if (!bf.validate()) throw new InvalidCompanyRecord(data);
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
        errorHandler(err);
    }
}
