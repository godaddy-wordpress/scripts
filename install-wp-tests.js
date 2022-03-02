// First two arguments are 'node' and patch to script.
const passedArgs = process.argv.slice(2);

if (passedArgs.length < 2) {
  // eslint-disable-next-line no-console
  console.log('usage: node install-wp-tests.js <db-name> <db-user> <db-pass> [db-host] [wp-version] [skip-database-creation]');
  process.exit(1);
}

let archiveName;
const dbName = passedArgs[0];
const dbUser = passedArgs[1];
const dbPass = passedArgs[2];
const dbHost = passedArgs?.[3] ? passedArgs[3] : 'localhost';
const wpVersion = passedArgs?.[4] ? passedArgs[4] : 'latest';
const skipDbCreate = passedArgs?.[5] ? passedArgs[5] : 'false';
let wpTestsTag;

const fs = require('fs');
const os = require('os');
// const path = require('path');
const { Curl } = require('node-libcurl');
const util = require('./utils');

// console.log(os.tmpdir());
const tmpDir = fs.mkdtempSync(os.tmpdir());

const wpTestsDir = `${tmpDir}/wordpress-tests-lib`;
const wpCoreDir = `${tmpDir}/wordpress/`;

fs.rmSync(wpTestsDir, { recursive: true, force: true });
fs.rmSync(wpCoreDir, { recursive: true, force: true });

const installWordPress = async () => {
  if (fs.existsSync(wpCoreDir)) {
    // Directory exists short circuit.
    process.exit(0);
  }

  await fs.promises.mkdir(wpCoreDir, { recursive: true });

  if (wpVersion === 'nightly' || wpVersion === 'trunk') {
    try {
      await fs.promises.mkdir(`${tmpDir}/wordpress-nightly`, { recursive: true });
      await util.download('https://wordpress.org/nightly-builds/wordpress-latest.zip', `${tmpDir}/wordpress-nightly.zip`);
      await util.unzip(`${tmpDir}/wordpress-nightly.zip`, `${tmpDir}/`);
      await fs.promises.rename(`${tmpDir}/wordpress-nightly/`, wpCoreDir);
    } catch (coreDownloadError) {
      throw new Error(`Core download failure occurred: ${coreDownloadError}`);
    }
    return;
  }

  await util.download(`https://wordpress.org/${archiveName}.zip`, `${tmpDir}/wordpress.zip`);
  await util.unzip(`${tmpDir}/wordpress.zip`, `${tmpDir}/`);
};

const setTestsTag = (versionDataString) => {
  const isRcRegex = /^[0-9]+\.[0-9]+-(beta|RC)[0-9]+$/;
  if (wpVersion.match(isRcRegex)?.[1]) {
    const newTag = wpVersion.replace(/-beta|-RC[0-9]+$/, '');
    wpTestsTag = `branches/${newTag}`;
    archiveName = `wordpress-${newTag}`;
    return;
  }

  const isBranchRegex = /^[0-9]+\.[0-9]+$/;
  if (wpVersion.match(isBranchRegex)) {
    wpTestsTag = `branches/${wpVersion}`;
    archiveName = `wordpress-${wpVersion}`;
    return;
  }

  const isVersionRegex = /[0-9]+\.[0-9]+\.[0-9]+/;
  if (wpVersion.match(isVersionRegex)) {
    // version x.x.0 = first release of the major version strip the .0
    const newTag = wpVersion.replace('.0', '');
    wpTestsTag = `tags/${newTag}`;
    archiveName = `wordpress-${newTag}`;
    return;
  }

  if (wpVersion === 'nightly' || wpVersion === 'trunk') {
    wpTestsTag = 'trunk';
    return;
  }

  const latestVersionRegex = /[0-9]+\.[0-9]+(\.[0-9]+)?/mg;
  const versionMatch = versionDataString.match(latestVersionRegex);
  if (versionMatch) {
    const newTag = versionMatch?.[0];

    wpTestsTag = `tags/${newTag}`;
    archiveName = 'latest';
    return;
  }

  if (!wpTestsTag) {
    // eslint-disable-next-line no-console
    console.log('Error: Unable to parse latest version.');
    process.exit(1);
  }
};

const writeToTmp = (response, data) => {
  const jsonString = JSON.stringify(data);
  fs.writeFile('/tmp/wp-latest-json', jsonString, async (err) => {
    if (err) {
      throw new Error('Error writing file', err);
    }

    const wpLatestData = fs.readFileSync('/tmp/wp-latest-json', 'utf8');
    await setTestsTag(wpLatestData);
    await installWordPress();
  });
};

const curl = new Curl();
const close = curl.close.bind(curl);

curl.setOpt('URL', 'http://api.wordpress.org/core/version-check/1.7/');
curl.on('end', writeToTmp);
curl.on('error', close);

curl.perform();
