// First two arguments are 'node' and patch to script.
const passedArgs = process.argv.slice( 2 );

if ( passedArgs.length < 2 ) {
	// eslint-disable-next-line no-console
	throw new Error( 'usage: node install-wp-tests.js <db-name> <db-user> <db-pass> [db-host] [wp-version] [skip-database-creation]' );
}

let archiveName;
const dbName = passedArgs[ 0 ];
const dbUser = passedArgs[ 1 ];
const dbPass = passedArgs[ 2 ];
const dbHost = passedArgs?.[ 3 ] ? passedArgs[ 3 ] : 'localhost';
const wpVersion = passedArgs?.[ 4 ] ? passedArgs[ 4 ] : 'latest';
const skipDbCreate = passedArgs?.[ 5 ] ? passedArgs[ 5 ] : false;
let wpTestsTag;

const fs = require( 'fs' );
const os = require( 'os' );
const { download, unzip } = require( './utils' );
const tmpDir = fs.mkdtempSync( os.tmpdir() );

const wpTestsDir = `${ tmpDir }/wordpress-tests-lib`;
const wpCoreDir = `${ tmpDir }/wordpress/`;

fs.rmSync( wpTestsDir, { force: true, recursive: true } );
fs.rmSync( wpCoreDir, { force: true, recursive: true } );

const installWordPress = async () => {
	if ( fs.existsSync( wpCoreDir ) ) {
		throw new Error( 'Directory exists short circuit' );
	}

	await fs.promises.mkdir( wpCoreDir, { recursive: true } );

	if ( wpVersion === 'nightly' || wpVersion === 'trunk' ) {
		try {
			await fs.promises.mkdir( `${ tmpDir }/wordpress-nightly`, { recursive: true } );
			await download( 'https://wordpress.org/nightly-builds/wordpress-latest.zip', `${ tmpDir }/wordpress-nightly.zip` );
			await unzip( `${ tmpDir }/wordpress-nightly.zip`, `${ tmpDir }/` );
			await fs.promises.rename( `${ tmpDir }/wordpress-nightly/`, wpCoreDir );
		} catch ( coreDownloadError ) {
			throw new Error( `Core download failure occurred: ${ coreDownloadError }` );
		}
		return;
	}

	await download( `https://wordpress.org/${ archiveName }.zip`, `${ tmpDir }/wordpress.zip` );
	await unzip( `${ tmpDir }/wordpress.zip`, `${ tmpDir }/` );
};

const setTestsTag = ( versionDataString ) => {
	const isRcRegex = /^[0-9]+\.[0-9]+-(beta|RC)[0-9]+$/;
	if ( wpVersion.match( isRcRegex )?.[ 1 ] ) {
		const newTag = wpVersion.replace( /-beta|-RC[0-9]+$/, '' );
		wpTestsTag = `branches/${ newTag }`;
		archiveName = `wordpress-${ newTag }`;
		return;
	}

	const isBranchRegex = /^[0-9]+\.[0-9]+$/;
	if ( wpVersion.match( isBranchRegex ) ) {
		wpTestsTag = `branches/${ wpVersion }`;
		archiveName = `wordpress-${ wpVersion }`;
		return;
	}

	const isVersionRegex = /[0-9]+\.[0-9]+\.[0-9]+/;
	if ( wpVersion.match( isVersionRegex ) ) {
		// version x.x.0 = first release of the major version strip the .0
		const newTag = wpVersion.replace( '.0', '' );
		wpTestsTag = `tags/${ newTag }`;
		archiveName = `wordpress-${ newTag }`;
		return;
	}

	if ( wpVersion === 'nightly' || wpVersion === 'trunk' ) {
		wpTestsTag = 'trunk';
		return;
	}

	const latestVersionRegex = /[0-9]+\.[0-9]+(\.[0-9]+)?/mg;
	const versionMatch = versionDataString.match( latestVersionRegex );
	if ( versionMatch ) {
		const newTag = versionMatch?.[ 0 ];

		wpTestsTag = `tags/${ newTag }`;
		archiveName = 'latest';
		return;
	}

	if ( ! wpTestsTag ) {
		// eslint-disable-next-line no-console
		throw new Error( 'Error: Unable to parse latest version.' );
	}
};

const installDatabase = async () => {
	if ( skipDbCreate ) {
		return;
	}

	const mysql = require( 'mysql' );
	const connection = mysql.createConnection( { host: dbHost, password: dbPass, user: dbUser } );
	connection.connect();

	// TODO: This is created in run_e2e_tests in config.yml.
	const circleCiJob = '';
	if ( circleCiJob === 'e2e-firefox' || circleCiJob === 'e2e-chrome' ) {
		// create the e2e test database
		connection.query( 'CREATE DATABASE coblocks', ( error ) => {
			if ( error ) {
				throw error;
			}
		} );
		connection.end();
		return;
	}

	connection.query( `CREATE DATABASE IF NOT EXISTS ${ dbName }`, ( error ) => {
		if ( error ) {
			throw error;
		}
	} );
	connection.end();
};

const installTestSuite = async () => {
	if ( ! fs.existsSync( wpTestsDir ) ) {
		await fs.promises.mkdir( wpTestsDir, { recursive: true } );

		const Client = require( 'svn-spawn' );
		const client = new Client( { cwd: wpTestsDir } );
		const handleError = ( err ) => {
			if ( err ) {
				throw ( err );
			}
		};

		const coDefaults = [ 'co', '--quiet', '--ignore-externals' ];
		client.cmd(
			coDefaults.concat( `https://develop.svn.wordpress.org/${ wpTestsTag }/tests/phpunit/includes/ ${ wpTestsDir }/includes`.split( ' ' ) ),
			( err ) => handleError( err ) );

		client.cmd(
			coDefaults.concat( `https://develop.svn.wordpress.org/${ wpTestsTag }/tests/phpunit/data/ ${ wpTestsDir }/data`.split( ' ' ) ),
			( err ) => handleError( err ) );
	}

	if ( ! fs.existsSync( `${ wpTestsDir }/wp-tests-config.php` ) ) {
		await download( `https://develop.svn.wordpress.org/${ wpTestsTag }/wp-tests-config-sample.php`, `${ wpTestsDir }/wp-tests-config.php` );
		let wpTestsConfig = fs.readFileSync( `${ wpTestsDir }/wp-tests-config.php`, 'utf8' );

		wpTestsConfig = wpTestsConfig.replace( "dirname( __FILE__ ) . '/src/'", `'${ wpCoreDir }'` );
		wpTestsConfig = wpTestsConfig.replace( 'youremptytestdbnamehere', dbName );
		wpTestsConfig = wpTestsConfig.replace( 'yourusernamehere', dbUser );
		wpTestsConfig = wpTestsConfig.replace( 'yourpasswordhere', dbPass );
		wpTestsConfig = wpTestsConfig.replace( 'localhost', dbHost );

		fs.writeFileSync( `${ wpTestsDir }/wp-tests-config.php`, wpTestsConfig );
	}
};

const syncLatestData = async () => {
	await download( 'http://api.wordpress.org/core/version-check/1.7/', `/tmp/wp-latest.json` );
	const wpLatestData = fs.readFileSync( '/tmp/wp-latest.json', 'utf8' );
	await setTestsTag( wpLatestData );
};

( async () => {
	await syncLatestData();
	await installWordPress();
	await installTestSuite();
	await installDatabase();
} )();
