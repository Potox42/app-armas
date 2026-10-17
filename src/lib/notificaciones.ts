import * as Notifications from 'expo-notifications';
import type { AvisoProgramado } from './planAvisos';

// Con la app abierta también se muestra el aviso.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false,
  }),
});

export const avisosDisponibles = true;

export async function pedirPermisoAvisos(): Promise<boolean> {
  const actual = await Notifications.getPermissionsAsync();
  if (actual.granted) return true;
  const r = await Notifications.requestPermissionsAsync();
  return r.granted;
}

/** Sustituye todos los avisos programados por los del plan. */
export async function programarAvisos(plan: AvisoProgramado[]): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  for (const a of plan) {
    await Notifications.scheduleNotificationAsync({
      identifier: a.id,
      content: { title: a.titulo, body: a.cuerpo },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: a.fecha },
    });
  }
}

export async function quitarAvisos(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function avisoDePrueba(): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: { title: 'Tirador Deportivo', body: 'Así te llegarán los avisos de caducidad y revista.' },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5 },
  });
}
