const { createWriteStream } = require( 'fs' );
const { pipeline } = require( 'stream' );
const { promisify } = require( 'util' );
const AdmZip = require( 'adm-zip' );
const fs = require( 'fs' ).promises;

// Disable reason: Not sure why this is unsupported because Node 17 should support es.
// eslint-disable-next-line node/no-unsupported-features/es-syntax
const fetch = ( ...args ) => import( 'node-fetch' ).then( ( { default: asyncFetch } ) => asyncFetch( ...args ) );

const download = async ( url, path ) => {
	const streamPipeline = promisify( pipeline );

	const response = await fetch( url );

	if ( ! response.ok ) {
		throw new Error( `unexpected response ${ response.statusText }` );
	}

	await streamPipeline( response.body, createWriteStream( path ) );
};

const unzip = async ( file, path ) => {
	const zip = new AdmZip( file );
	zip.extractAllTo( path, true );
};

const doesFileExist = async ( path ) => {
	try {
		await fs.access( path, fs.F_OK );
		return true;
	} catch ( err ) {
		return false;
	}
};

const handleError = ( error ) => {
	if ( error ) {
		throw ( error );
	}
};

const logToConsole = ( data, type = 'table' ) => {
	if ( type === 'table' ) {
		// Disable reason: We allow table to console for explicit logging scenarios.
		// eslint-disable-next-line no-console
		console.table( data );
		return;
	}
	// Disable reason: We allow log to console for explicit logging scenarios.
	// eslint-disable-next-line no-console
	console.log( data );
};

exports.download = download;
exports.unzip = unzip;
exports.doesFileExist = doesFileExist;
exports.handleError = handleError;
exports.logToConsole = logToConsole;
