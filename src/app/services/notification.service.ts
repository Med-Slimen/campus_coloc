import { Injectable } from '@angular/core';
import { db } from '../firebase';
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  updateDoc,
  doc,
  writeBatch,
  onSnapshot
} from 'firebase/firestore';
import { Notification } from '../models';

// Service de gestion des notifications utilisateurs Firestore
@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  // Enregistre une nouvelle notification pour un utilisateur
  async create(data: Omit<Notification, 'id'>): Promise<string> {
    const colRef = collection(db, 'notifications');
    const docRef = await addDoc(colRef, {
      ...data,
      lue: data.lue ?? false,
      dateEnvoi: data.dateEnvoi || new Date().toISOString()
    });
    return docRef.id;
  }

  // Récupère l'intégralité des notifications de l'utilisateur triées par date décroissante
  async getMine(userId: string): Promise<Notification[]> {
    const colRef = collection(db, 'notifications');
    const q = query(colRef, where('userId', '==', userId));
    const snap = await getDocs(q);
    const notifications = snap.docs.map(d => ({
      id: d.id,
      ...(d.data() as Notification)
    }));
    return notifications.sort((a, b) => (b.dateEnvoi || '').localeCompare(a.dateEnvoi || ''));
  }

  // Alias rétro-compatible pour getMine
  async getNotificationsByUser(userId: string): Promise<Notification[]> {
    return this.getMine(userId);
  }

  // Marque une notification spécifique comme consultée
  async markAsRead(notificationId: string): Promise<void> {
    const docRef = doc(db, 'notifications', notificationId);
    await updateDoc(docRef, { lue: true });
  }

  // Alias rétro-compatible pour markAsRead
  async marquerCommeLue(id: string): Promise<void> {
    return this.markAsRead(id);
  }

  // Marque toutes les notifications non lues d'un utilisateur comme lues via un writeBatch atomique
  async markAllAsRead(userId: string): Promise<void> {
    const colRef = collection(db, 'notifications');
    const q = query(colRef, where('userId', '==', userId));
    const snap = await getDocs(q);
    const unreadDocs = snap.docs.filter(d => !d.data()['lue']);
    if (unreadDocs.length === 0) return;

    const batch = writeBatch(db);
    for (const d of unreadDocs) {
      batch.update(d.ref, { lue: true });
    }
    await batch.commit();
  }

  // Écoute en temps réel les notifications non lues d'un utilisateur via onSnapshot
  listenUnread(
    userId: string,
    callback: (unreadNotifications: Notification[], unreadCount: number) => void
  ): () => void {
    const colRef = collection(db, 'notifications');
    const q = query(colRef, where('userId', '==', userId));
    return onSnapshot(
      q,
      (snapshot) => {
        const notifs = snapshot.docs.map(d => ({
          id: d.id,
          ...(d.data() as Notification)
        }));
        const nonLues = notifs
          .filter(n => !n.lue)
          .sort((a, b) => (b.dateEnvoi || '').localeCompare(a.dateEnvoi || ''));
        callback(nonLues, nonLues.length);
      },
      (error) => {
        console.warn('Erreur écoute notifications non lues:', error);
      }
    );
  }
}
