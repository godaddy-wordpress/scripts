'use strict';
( async () => {
	// First two arguments are 'node' and patch to script.
	const passedArgs = process.argv.slice( 2 );

	if ( passedArgs.length < 2 ) {
	// eslint-disable-next-line no-console
		handleError( new Error( 'usage: node install-wp-tests.js <db-name> <db-user> <db-pass> [db-host] [wp-version] [skip-database-creation]' ) );
	}

	let archiveName;
	const dbName = passedArgs[ 0 ];
	const dbUser = passedArgs[ 1 ];
	const dbPass = passedArgs[ 2 ];
	const dbHost = passedArgs?.[ 3 ] ? passedArgs[ 3 ] : 'localhost';
	const wpVersion = passedArgs?.[ 4 ] ? passedArgs[ 4 ] : 'latest';
	const skipDbCreate = passedArgs?.[ 5 ] ? passedArgs[ 5 ] : false;
	let wpTestsTag;

	const fs = require( 'fs' ).promises;
	const os = require( 'os' );
	const { download, unzip, doesFileExist, handleError } = require( './utils' );
	const tmpDir = await fs.mkdtemp( os.tmpdir() );

	const wpTestsDir = `${ tmpDir }/wordpress-tests-lib`;
	const wpCoreDir = `${ tmpDir }/wordpress/`;

	const installWordPress = async () => {
		if ( await doesFileExist( wpCoreDir ) ) {
			handleError( new Error( 'Directory exists short circuit' ) );
		}

		await fs.mkdir( wpCoreDir, { recursive: true } );

		if ( wpVersion === 'nightly' || wpVersion === 'trunk' ) {
			try {
				await fs.mkdir( `${ tmpDir }/wordpress-nightly`, { recursive: true } );
				await download( 'https://wordpress.org/nightly-builds/wordpress-latest.zip', `${ tmpDir }/wordpress-nightly.zip` );
				await unzip( `${ tmpDir }/wordpress-nightly.zip`, `${ tmpDir }/` );
				await fs.rename( `${ tmpDir }/wordpress-nightly/`, wpCoreDir );
			} catch ( coreDownloadError ) {
				handleError( new Error( `Core download failure occurred: ${ coreDownloadError }` ) );
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
			handleError( new Error( 'Error: Unable to parse latest version.' ) );
		}
	};

	const installDatabase = async () => {
		if ( skipDbCreate ) {
			return;
		}

		const mysql = require( 'mysql' );
		const connection = mysql.createConnection( { host: dbHost, password: dbPass, user: dbUser } );
		connection.connect();

		const circleCiJob = process.env.CIRCLE_JOB;
		if ( circleCiJob === 'e2e-firefox' || circleCiJob === 'e2e-chrome' ) {
		// create the e2e test database
			connection.query( 'CREATE DATABASE coblocks', handleError );
			connection.end();
			return;
		}

		connection.query( `CREATE DATABASE IF NOT EXISTS ${ dbName }`, handleError );
		connection.end();
	};

	const installTestSuite = async () => {
		if ( ! await doesFileExist( wpTestsDir ) ) {
			await fs.mkdir( wpTestsDir, { recursive: true } );

			const Client = require( 'svn-spawn' );
			const client = new Client( { cwd: wpTestsDir } );
			const coDefaults = [ 'co', '--quiet', '--ignore-externals' ];

			client.cmd(
				coDefaults.concat(
					[ `https://develop.svn.wordpress.org/${ wpTestsTag }/tests/phpunit/includes/`, `${ wpTestsDir }/includes` ],
				), handleError );

			client.cmd(
				coDefaults.concat(
					[ `https://develop.svn.wordpress.org/${ wpTestsTag }/tests/phpunit/data/`, `${ wpTestsDir }/data` ],
				), handleError );
		}

		if ( ! await doesFileExist( `${ wpTestsDir }/wp-tests-config.php` ) ) {
			await download( `https://develop.svn.wordpress.org/${ wpTestsTag }/wp-tests-config-sample.php`, `${ wpTestsDir }/wp-tests-config.php` );
			let wpTestsConfig = await fs.readFile( `${ wpTestsDir }/wp-tests-config.php`, 'utf8' );

			wpTestsConfig = wpTestsConfig.replace( "dirname( __FILE__ ) . '/src/'", `'${ wpCoreDir }'` );
			wpTestsConfig = wpTestsConfig.replace( 'youremptytestdbnamehere', dbName );
			wpTestsConfig = wpTestsConfig.replace( 'yourusernamehere', dbUser );
			wpTestsConfig = wpTestsConfig.replace( 'yourpasswordhere', dbPass );
			wpTestsConfig = wpTestsConfig.replace( 'localhost', dbHost );

			await fs.writeFile( `${ wpTestsDir }/wp-tests-config.php`, wpTestsConfig );
		}
	};

	const syncLatestData = async () => {
		await download( 'http://api.wordpress.org/core/version-check/1.7/', `/tmp/wp-latest.json` );
		const wpLatestData = fs.readFile( '/tmp/wp-latest.json', 'utf8' );
		await setTestsTag( wpLatestData );
		await fs.rm( wpTestsDir, { force: true, recursive: true } );
		await fs.rm( wpCoreDir, { force: true, recursive: true } );
	};

	await syncLatestData();
	await installWordPress();
	await installTestSuite();
	await installDatabase();
} )();
