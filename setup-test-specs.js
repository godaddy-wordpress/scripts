const util = require( 'util' );
const exec = util.promisify( require( 'child_process' ).exec );
const { match } = require( 'node-match-path' );
const fs = require( 'fs' );
const glob = require( 'glob' );
const { handleError, logToConsole } = require( './utils' );


const specs = [];
const specString = '';

async function boot() {
	const { stdout: gitDiffOutput, stderr } = await exec( 'cd ../coblocks && git diff --name-only origin/master' );
	handleError(stderr);

	const changedFiles = gitDiffOutput.split( '\n' );

	changedFiles.map( ( file ) => {
		if ( file === '' ) {
			return;
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
				specString.concat( `src/blocks/${testSpec}/**/*.cypress.js` );
			} else {
				specString.concat( `,src/blocks/${testSpec}/**/*.cypress.js` );
			}
		}

		if ( isExtFile.matches === true ) {
			if ( ! specs.includes( specName ) ) {
				specs.push( specName );
			}

			glob( `src/extensions/${ specName }/**/*.cypress.js`, ( err, res ) => {
				if ( res.length === 0 ) {
					continue;
				}
			} );

			if ( specString.length === 0 ) {
				specString.concat( `src/extensions/${testSpec}/**/*.cypress.js` );
			} else {
				specString.concat( `,src/extensions/${testSpec}/**/*.cypress.js` );
			}
		}

		if ( isComponentFile.matches === true ) {
			if ( ! specs.includes( specName ) ) {
				specs.push( specName );
			}

			glob( `src/components/${ specName }/**/*.cypress.js`, ( err, res ) => {
				if ( res.length === 0 ) {
					continue;
				}
			} );

			if ( specString.length === 0 ) {
				specString.concat( `src/components/${testSpec}/**/*.cypress.js` );
			} else {
				specString.concat( `,src/components/${testSpec}/**/*.cypress.js` );
			}
		}
	} );

	logToConsole(`Running the following Cypress spec files: ${specs.map( s => `${s} `)}`);

	fs.writeFile( '/tmp/specstring', specString );
}

boot();

