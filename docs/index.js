const {localCrontabToUtcCrontabs} = require('local-crontab');
const Selectr = require('mobius1-selectr');
const {zones} = require('tzdata');


const updateCrontab = () => {
  try {
    const localCrontab = document.querySelector('#input').value;
    const timezone = document.querySelector('#timezone').value;
    const utcCrontabs = localCrontabToUtcCrontabs(localCrontab, timezone);
    document.querySelector('#output').innerHTML = utcCrontabs.join('<br>');
  } catch (error){
    document.querySelector('#output').innerHTML = `error: ${error}`;
  }
};

document.querySelector('#timezone').innerHTML = Object.keys(zones)
  .map(zone => `<option value="${zone}">${zone}</option>`)
  .join('');
document.querySelector('#timezone').value = "America/New_York";
const selector = new Selectr('#timezone', {width: 250});

document.querySelector('#input').onkeyup = updateCrontab;
document.querySelector('#timezone').onchange = updateCrontab;
selector.on('selectr.change', updateCrontab);

updateCrontab();
