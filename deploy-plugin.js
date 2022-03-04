'use strict';
const { handleError, logToConsole } = require( './utils' );
const { exec } = require( 'child_process' );

( async () => {
	const os = require( 'os' );
	const Client = require( 'svn-spawn' );
	let client = new Client( { cwd: os.homedir() } );
	const fs = require( 'fs' ).promises;

	// Checkout Coblocks from WordPress.org
	client.cmd( [ 'co', 'http://svn.wp-plugins.org/coblocks', `${ os.homedir() }/coblocks` ], handleError );

	// Clean /trunk/ and copy over plugin files
	await fs.rm( `${ os.homedir() }/coblocks/trunk/`, { force: true, recursive: true } );
	await fs.copyFile( 'build/coblocks/', `${ os.homedir() }/coblocks/trunk/` );

	// TODO circleTag is coming from Circle CI.
	// Create the tag on the SVN repo and copy over plugin files
	client.cmd( [ 'cp', `${ os.homedir() }/coblocks`, `${ os.homedir() }/coblocks/tags/${ circleTag }` ], handleError );
	client.cmd( [ 'commit', '-m', `Tagging version ${ circleTag }` ], handleError );

	// Copy the WordPress.org assets over
	await fs.rm( `${ os.homedir() }/coblocks/assets/`, { force: true, recursive: true } );
	await fs.copyFile( '.wordpress-org/', `${ os.homedir() }/coblocks/assets/` );

	// Deploy Coblocks to WordPress.org
	client = new Client( { cwd: `${ os.homedir() }/coblocks` } );
	client.cmd( [ 'add', '*', `--force` ], handleError );

	// Delete removed files
	let filesToDelete;
	client.cmd( [ 'status' ], ( error, data ) => {
		handleError( error );
		filesToDelete = data.split( '\n' );
		filesToDelete.forEach( ( line, index ) => filesToDelete[ index ] = line.replace( '!       ', '' ) );
	} );

	// TODO  WP_ORG_USERNAME & WP_ORG_PASSWORD are from circle CI.
	const wpOrgUsername = '';
	const wpOrgPassword = '';
	// Deploy new version
	client.cmd(
		[
			'ci',
			'--no-auth-cache',
			'--username',
			`${ wpOrgUsername }`,
			'--password',
			`${ wpOrgPassword }`,
			'-m',
			'Deploy new version of CoBlocks',
		], logToConsole,
	);

	// TODO: these secrets all come from CI.
	const ghAuthToken = '';
	const circleProjectUername = '';
	const circleProjectReponame = '';
	const circleSha1 = '';
	const circleTag = '';
	let changelog = await fs.readFile( `${ os.homedir() }/development/wordpress/wp-content/plugins/coblocks/readme.txt`, 'utf8' );
	changelog = changelog.split( '== Changelog ==' ).join();

	exec( `ghr -t ${ ghAuthToken } -u ${ circleProjectUername } -r ${ circleProjectReponame } -c ${ circleSha1 } -b "${ changelog }" -delete ${ circleTag } /tmp/artifacts`,
		( error, stdout, stderr ) => {
			handleError( error );
			handleError( stderr );
			logToConsole( stdout, 'table' );
		} );
} )();
