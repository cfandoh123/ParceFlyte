import { handleAuth } from '@auth0/nextjs-auth0';

export const GET = handleAuth();

// export default handleAuth({
//   async callback(req, res) {
//     try {
//       // Handle the authentication callback
//       await handleCallback(req, res, {
//         redirectUri: 'http://localhost:3000/api/auth/callback', // Ensure this matches your Auth0 settings
//       });
//     } catch (error) {
//       res.status(error.status || 500).end(error.message);
//     }
//   },
// });
