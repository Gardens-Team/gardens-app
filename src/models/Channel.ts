export interface Channel {
    id: string;
    gardenId: string;
    name: string;
    description?: string;
    isAdministrative: boolean;
    createdAt: Date;
    updatedAt: Date;
  }