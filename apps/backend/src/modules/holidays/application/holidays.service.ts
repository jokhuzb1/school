type HolidaysRepository = {
  listBySchoolId(schoolId: string): Promise<any[]>;
  createBySchoolId(input: {
    schoolId: string;
    date: Date;
    name: string;
  }): Promise<any>;
  deleteById(id: string): Promise<void>;
};

export function createHolidaysService(repository: HolidaysRepository) {
  return {
    listHolidays(schoolId: string) {
      return repository.listBySchoolId(schoolId);
    },
    createHoliday(input: { schoolId: string; date: Date; name: string }) {
      return repository.createBySchoolId(input);
    },
    async removeHoliday(id: string) {
      await repository.deleteById(id);
    },
  };
}
