
'use strict';
( async () => {
	const util = require( 'util' );
	const exec = util.promisify( require( 'child_process' ).exec );
	const { match } = require( 'node-match-path' );
	const fs = require( 'fs' ).promises;
	const glob = require( 'glob' );
	const { handleError, logToConsole } = require( './utils' );

	const specs = [];
	let specString = '';
	// First two arguments are 'node' and patch to script.
	let passedArgs = process.argv.slice( 2 ).join( ' ' ) || '';
	if ( ! passedArgs ) {
		const {
			stdout: gitMainBranch,
			stderr: mainBranchErr,
		} = await exec( "git branch | cut -c 3- | grep -E '^master$|^main$'" );
		handleError( mainBranchErr );

		const {
			stdout: gitDiffOutput,
			stderr: gitDiffErr,
		} = await exec( `git diff --name-only $(git merge-base HEAD ${ gitMainBranch })` );
		handleError( gitDiffErr );
		passedArgs = gitDiffOutput;
	}

	const changedFiles = passedArgs.trim().split( '\n' );
	console.log( changedFiles );

	changedFiles.reduce( ( acc, file ) => {
		if ( file === '' ) {
			return acc;
		}

		const isBlockFile = match( 'src/blocks/*', file );
		const isExtFile = match( 'src/extensions/*', file );
		const isComponentFile = match( 'src/components/*', file );

		const specName = file.split( '/' )[ 2 ];

		if ( isBlockFile.matches === true ) {
			if ( ! specs.includes( specName ) ) {
				specs.push( specName );
			}

			if ( specString.length === 0 ) {
				specString = specString.concat( `src/blocks/${ specName }/**/*.cypress.js` );
			} else {
				specString = specString.concat( `,src/blocks/${ specName }/**/*.cypress.js` );
			}
		}

		if ( isExtFile.matches === true ) {
			if ( ! specs.includes( specName ) ) {
				specs.push( specName );
			}

			glob( `src/extensions/${ specName }/**/*.cypress.js`, ( err, res ) => {
				if ( res.length === 0 ) {
					return acc;
				}
			} );

			if ( specString.length === 0 ) {
				specString = specString.concat( `src/extensions/${ specName }/**/*.cypress.js` );
			} else {
				specString = specString.concat( `,src/extensions/${ specName }/**/*.cypress.js` );
			}
		}

		if ( isComponentFile.matches === true ) {
			if ( ! specs.includes( specName ) ) {
				specs.push( specName );
			}

			glob( `src/components/${ specName }/**/*.cypress.js`, ( err, res ) => {
				if ( res.length === 0 ) {
					return acc;
				}
			} );

			if ( specString.length === 0 ) {
				specString = specString.concat( `src/components/${ specName }/**/*.cypress.js` );
			} else {
				specString = specString.concat( `,src/components/${ specName }/**/*.cypress.js` );
			}
		}

		return acc;
	}, [] );

	if ( ! specString ) {
		handleError( 'No applicable specs detected', true );
	}
	logToConsole( `Running the following Cypress spec files: ${ specs.map( ( s ) => `${ s } ` ) }` );

	await fs.writeFile( '/tmp/specstring', specString );
} )();
