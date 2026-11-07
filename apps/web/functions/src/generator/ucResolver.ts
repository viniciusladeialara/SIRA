import { db } from "../db.js";

interface CurricularUnit {
  id: string;
  name: string;
  hours: number;
  order?: number;
}

/**
 * Busca todas as Unidades Curriculares de um curso e calcula os dias necessários
 */
export async function getCourseUnits(courseId: string, dailyWorkload: number): Promise<Array<CurricularUnit & { daysNeeded: number }>> {
  const unitsSnap = await db.collection("courses")
    .doc(courseId)
    .collection("curricular_units")
    .orderBy("order", "asc")
    .get();

  if (unitsSnap.empty) {
    return [];
  }

  return unitsSnap.docs.map(doc => {
    const data = doc.data();
    const hours = Number(data.hours) || 0;
    
    return {
      id: doc.id,
      name: data.name || "UC sem nome",
      hours: hours,
      order: data.order || 0,
      daysNeeded: Math.ceil(hours / dailyWorkload)
    };
  });
}
