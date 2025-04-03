// User model for the User entity
export interface User {
  id: string;
  username: string;
  profilePic?: string;
  visible: boolean;
  createdAt?: Date;
  publicKey: string;
  updatedAt?: Date;
  bio?: string;
  email?: string;
  phone?: string;
}