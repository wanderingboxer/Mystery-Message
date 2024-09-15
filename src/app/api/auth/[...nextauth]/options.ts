import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import dbConnect from '@/lib/dbConnect';
import UserModel from '@/model/User';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      id: 'credentials',
      name: 'Credentials',
      credentials: {
        identifier: { label: 'Identifier', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials: any): Promise<any> {
        await dbConnect();
        console.log('Database connected');

        if (!credentials || !credentials.identifier || !credentials.password) {
          console.log('Missing credentials');
          throw new Error('Missing credentials');
        }

        console.log('Received credentials:', credentials);

        try {
          const query = {
            $or: [
              { username: credentials.identifier },
              { email: credentials.identifier },
            ],
          };
          console.log('Executing query:', query);

          const user = await UserModel.findOne(query).lean();
          console.log('User found:', user);

          if (!user) {
            console.log('No user found with this identifier');
            throw new Error('No user found with this identifier');
          }

          if (!user.isVerified) {
            console.log('Please verify your account before logging in');
            throw new Error('Please verify your account before logging in');
          }

          const isPasswordCorrect = await bcrypt.compare(credentials.password, user.password);

          if (isPasswordCorrect) {
            console.log('User found & password correct');
            return user;
          } else {
            console.log('Incorrect password');
            throw new Error('Incorrect password');
          }
        } catch (err: any) {
          console.error('Error during authentication:', err);
          throw new Error(err.message || 'Internal server error');
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token._id = user._id?.toString(); 
        token.isVerified = user.isVerified;
        token.isAcceptingMessages = user.isAcceptingMessages;
        token.username = user.username;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user._id = token._id;
        session.user.isVerified = token.isVerified;
        session.user.isAcceptingMessages = token.isAcceptingMessages;
        session.user.username = token.username;
      }
      return session;
    },
  },
  session: {
    strategy: 'jwt',
  },
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: '/sign-in',
  },
};