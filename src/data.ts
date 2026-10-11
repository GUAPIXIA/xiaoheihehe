export interface Community { id: number; name: string; short: string; color: string; members: string; icon: string }
export interface Post {
  id: number; userId: string; author: string; avatar: string; avatarUrl: string; color: string; time: string;
  title: string; excerpt: string; body: string[]; topicIds: number[]; topics: Community[];
  likes: number; comments: number; images: string[]; kind?: string; followed?: boolean;
  level: number; medalUrl: string; medalName: string; liked: boolean; createdAt: number; videoUrl: string; isCy: boolean;
}
export interface Comment {
  id: number; userId: string; author: string; avatar: string; avatarUrl: string; text: string; likes: number; time: string; rootId: number;
  level: number; medalUrl: string; medalName: string; pinned: boolean; isAuthor: boolean; createdAt: number;
  replyTo: string; replyCount: number; hasMoreReplies: boolean; replies: Comment[];
}
