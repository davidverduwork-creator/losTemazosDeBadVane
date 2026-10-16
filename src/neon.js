import { createClient, SupabaseAuthAdapter } from '@neondatabase/neon-js';

const authUrl = import.meta.env.VITE_NEON_AUTH_URL;
const dataApiUrl = import.meta.env.VITE_NEON_DATA_API_URL;

export function crearClienteNeon() {
    if (!authUrl || !dataApiUrl) {
        throw new Error('Configura VITE_NEON_AUTH_URL y VITE_NEON_DATA_API_URL en .env.local.');
    }

    return createClient({
        auth: {
            adapter: SupabaseAuthAdapter(),
            url: authUrl
        },
        dataApi: {
            url: dataApiUrl
        }
    });
}
