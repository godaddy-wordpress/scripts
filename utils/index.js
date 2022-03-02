const { createWriteStream } = require( 'fs' );
const { pipeline } = require( 'stream' );
const { promisify } = require( 'util' );
const AdmZip = require( 'adm-zip' );

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

exports.download = download;
exports.unzip = unzip;
